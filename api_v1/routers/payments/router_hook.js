import express from 'express';
import db_pool from "../../global/database.js";
import { stripe_gateway, tools } from "../../global/functions.js";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_SIGNING_SECRET ?? "";

const webhook_router = express.Router();

webhook_router.post('/', async (req, res) => {
    const sigHeader = req.headers["stripe-signature"];
    const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    // @ts-ignore
    const reqBody = req?.rawBody ?? req.body;

    let event;

    try {
        if (!signature || !reqBody) {
            console.error('Webhook validation failed: Missing signature or payload');
            return res.status(400).json({ code: 400, message: "Missing webhook signature or payload" });
        }

        if (!STRIPE_WEBHOOK_SECRET) {
            console.error('Webhook secret not configured');
            return res.status(500).json({ code: 500, message: "Webhook configuration error" });
        }

        event = stripe_gateway.webhooks.constructEvent(
            reqBody,
            signature,
            STRIPE_WEBHOOK_SECRET
        );

    } catch (err) {
        // @ts-ignore
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).json({ code: 400, message: "Webhook signature verification failed" });
    }

    try {
        const result = await processWebhookEvent(event);

        if (result.success) {
            return res.status(200).json({ code: 200, message: "Webhook processed successfully" });
        } else {
            console.error('Webhook processing failed:', result.error);
            return res.status(500).json({ code: 500, message: "Webhook processing failed" });
        }

    } catch (error) {
        console.error('Unexpected error processing webhook:', error);
        return res.status(500).json({ code: 500, message: "Internal server error" });
    }
});

/**
 * @param {import("stripe").Stripe.Event} event
 */
async function processWebhookEvent(event) {
    const maxRetries = 3;

    // Deduplicate: skip events already processed
    try {
        await db_pool.query(
            `INSERT INTO stripe_events (event_id) VALUES (?)`,
            [event.id]
        );
    } catch (dupError) {
        // Duplicate key means this event was already handled
        console.log(`Duplicate webhook event skipped: ${event.id}`);
        return { success: true };
    }

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const metadata = session.metadata || {};

            const sku_variant = metadata.sku_variant;
            const paymentId = metadata.paymentId;
            const userId = metadata.userId;
            const type = session.mode;

            if (!userId || !paymentId || !sku_variant) {
                console.error('Missing required metadata in checkout.session.completed');
                return { success: false, error: 'Missing required metadata' };
            }

            try {
                if (type === "subscription") {
                    const sessionSubscription = session.subscription;
                    const subscriptionId = typeof sessionSubscription === 'string'
                        ? sessionSubscription
                        : sessionSubscription?.id;

                    if (!subscriptionId) {
                        console.error('Missing subscription ID for subscription checkout');
                        return { success: false, error: 'Missing subscription ID' };
                    }

                    await updatePaymentStatus(paymentId, 'completed', subscriptionId);

                    let subscription_details;
                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            // @ts-ignore
                            subscription_details = await stripe_gateway.subscriptions.retrieve(subscriptionId);
                            break;
                        } catch (stripeError) {
                            console.error(`Stripe subscription retrieve attempt ${attempt} failed:`, stripeError);
                            if (attempt === maxRetries) {
                                return { success: false, error: 'Failed to retrieve subscription details' };
                            }
                            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                        }
                    }

                    // @ts-ignore
                    const startsAt = subscription_details?.current_period_start ?? 0;
                    // @ts-ignore
                    const expiresAt = subscription_details?.items?.data?.[0]?.current_period_end ?? 0;
                    const genId = tools.generateAlphanumeric(10, tools.randomInt(20, 50));

                    const connection = await db_pool.getConnection();
                    try {
                        await connection.beginTransaction();

                        await connection.query(
                            `INSERT INTO subscriptions
                            (id, user_id, variant_id_ref, start_date, end_date,
                             external_platform, external_id, payment_id_ref, status)
                            VALUES
                            (?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?),
                             1, ?, ?, 1)`,
                            [genId, userId, sku_variant, startsAt, expiresAt, subscriptionId, paymentId]
                        );

                        await connection.commit();
                        console.log(`Subscription created successfully: ${genId}`);
                        return { success: true };

                    } catch (dbError) {
                        await connection.rollback();
                        console.error('Database transaction failed for subscription:', dbError);
                        return { success: false, error: 'Database error creating subscription' };
                    } finally {
                        connection.release();
                    }

                } else if (type === "payment") {
                    await updatePaymentStatus(paymentId, 'completed', session.id);
                    console.log(`One-time payment completed: ${paymentId}`);
                    return { success: true };
                }

            } catch (error) {
                console.error('Error processing checkout.session.completed:', error);
                return { success: false, error: 'Processing error' };
            }

            return { success: true };
        }

        case "invoice.payment_succeeded": {
            const invoice = event.data.object;
            // @ts-ignore
            const invoiceSubscription = invoice.subscription;
            const subscriptionId = typeof invoiceSubscription === 'string'
                ? invoiceSubscription
                : invoiceSubscription?.id;

            if (!subscriptionId) {
                console.error('Missing subscription ID in invoice.payment_succeeded');
                return { success: false, error: 'Missing subscription ID' };
            }

            try {
                const connection = await db_pool.getConnection();
                try {
                    await connection.beginTransaction();

                    let subscription_details;
                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            subscription_details = await stripe_gateway.subscriptions.retrieve(subscriptionId);
                            break;
                        } catch (stripeError) {
                            console.error(`Stripe subscription retrieve attempt ${attempt} failed:`, stripeError);
                            if (attempt === maxRetries) {
                                await connection.rollback();
                                return { success: false, error: 'Failed to retrieve subscription details' };
                            }
                            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                        }
                    }

                    // @ts-ignore
                    const newEndDate = subscription_details?.current_period_end ?? 0;

                    // Look up our subscription record to get user_id and variant for the renewal payment
                    const [subRows] = await connection.query(
                        `SELECT user_id, variant_id_ref FROM subscriptions WHERE external_id = ? LIMIT 1`,
                        [subscriptionId]
                    );

                    await connection.query(
                        `UPDATE subscriptions SET end_date = FROM_UNIXTIME(?), status = 1
                         WHERE external_id = ?`,
                        [newEndDate, subscriptionId]
                    );

                    // Create a payment record for the renewal so every charge is tracked
                    if (Array.isArray(subRows) && subRows.length > 0) {
                        /** @type {any} */
                        const sub = subRows[0];
                        const renewalPaymentId = `pay${tools.generateAlphanumeric(10, tools.randomInt(20, 50))}`;
                        const amountPaid = (invoice.amount_paid ?? 0) / 100;
                        const currency = (invoice.currency ?? 'usd').toUpperCase();

                        await connection.query(
                            `INSERT INTO payments
                            (payment_id, type, user_id_ref, p_amount, p_currency,
                             variant_ref, status, p_transaction_reference)
                            VALUES (?, 1, ?, ?, ?, ?, 1, ?)`,
                            [renewalPaymentId, sub.user_id, amountPaid, currency,
                             sub.variant_id_ref, invoice.id ?? '']
                        );
                    }

                    await connection.commit();
                    console.log(`Subscription renewed successfully: ${subscriptionId}`);
                    return { success: true };

                } catch (dbError) {
                    await connection.rollback();
                    console.error('Database transaction failed for invoice payment succeeded:', dbError);
                    return { success: false, error: 'Database error updating subscription' };
                } finally {
                    connection.release();
                }

            } catch (error) {
                console.error('Error processing invoice.payment_succeeded:', error);
                return { success: false, error: 'Processing error' };
            }
        }

        case "invoice.payment_failed": {
            const invoice = event.data.object;
            // @ts-ignore
            const invoiceSubscription = invoice.subscription;
            const subscriptionId = typeof invoiceSubscription === 'string'
                ? invoiceSubscription
                : invoiceSubscription?.id;

            if (!subscriptionId) {
                console.error('Missing subscription ID in invoice.payment_failed');
                return { success: false, error: 'Missing subscription ID' };
            }

            try {
                const connection = await db_pool.getConnection();
                try {
                    await connection.beginTransaction();

                    const attemptCount = invoice.attempt_count || 0;
                    const nextPaymentAttempt = invoice.next_payment_attempt;

                    // 3=cancelled, 2=past_due
                    const newStatus = (!nextPaymentAttempt || attemptCount >= 3) ? 3 : 2;

                    await connection.query(
                        `UPDATE subscriptions SET status = ?
                         WHERE external_id = ?`,
                        [newStatus, subscriptionId]
                    );

                    const genReportId = tools.generateAlphanumeric(11, 30);
                    const reportData = JSON.stringify({
                        subscriptionId,
                        attempt: attemptCount,
                        event: 'payment_failed'
                    });

                    await connection.query(
                        `INSERT INTO logreports (report_id, report_type, report_data, report_status, report_currentuser)
                         SELECT ?, 'payment_failed', ?, 0, s.user_id
                         FROM subscriptions s WHERE s.external_id = ?
                         LIMIT 1`,
                        [genReportId, reportData, subscriptionId]
                    );

                    await connection.commit();
                    console.log(`Subscription payment failed: ${subscriptionId}, status: ${newStatus}`);
                    return { success: true };

                } catch (dbError) {
                    await connection.rollback();
                    console.error('Database transaction failed for invoice payment failed:', dbError);
                    return { success: false, error: 'Database error updating subscription status' };
                } finally {
                    connection.release();
                }

            } catch (error) {
                console.error('Error processing invoice.payment_failed:', error);
                return { success: false, error: 'Processing error' };
            }
        }

        case "customer.subscription.deleted": {
            const subscription = event.data.object;
            const subscriptionId = subscription.id;

            try {
                await db_pool.query(
                    `UPDATE subscriptions SET status = 3
                     WHERE external_id = ?`,
                    [subscriptionId]
                );

                console.log(`Subscription cancelled: ${subscriptionId}`);
                return { success: true };

            } catch (error) {
                console.error('Error processing customer.subscription.deleted:', error);
                return { success: false, error: 'Database error cancelling subscription' };
            }
        }

        default:
            console.log(`Unhandled webhook event: ${event.type}`);
            return { success: true };
    }
}

// payments.status tinyint: 0=pending, 1=completed, 2=refunded, 3=failed
const PAYMENT_STATUS = { pending: 0, completed: 1, refunded: 2, failed: 3 };

/**
 * @param {string} paymentId
 * @param {'pending'|'completed'|'refunded'|'failed'} statusKey
 * @param {string} [transactionReference]
 */
async function updatePaymentStatus(paymentId, statusKey, transactionReference) {
    try {
        const statusCode = PAYMENT_STATUS[statusKey] ?? 0;
        let query = `UPDATE payments SET status = ?`;
        /** @type {any[]} */
        let params = [statusCode];

        if (transactionReference) {
            query += `, p_transaction_reference = ?`;
            params.push(transactionReference);
        }

        query += ` WHERE payment_id = ?`;
        params.push(paymentId);

        await db_pool.query(query, params);
    } catch (error) {
        console.error(`Failed to update payment status for ${paymentId}:`, error);
        throw error;
    }
}

export default webhook_router;
