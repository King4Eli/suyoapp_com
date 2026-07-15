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
            tools.serverLog('Webhook validation failed: Missing signature or payload', "hook_135");
            return res.status(400).json({ code: 400, message: "Missing webhook signature or payload" });
        }

        if (!STRIPE_WEBHOOK_SECRET) {
            tools.serverLog('Webhook secret not configured', "hook_136");
            return res.status(500).json({ code: 500, message: "Webhook configuration error" });
        }

        event = stripe_gateway.webhooks.constructEvent(
            reqBody,
            signature,
            STRIPE_WEBHOOK_SECRET
        );

    } catch (err) {
        // @ts-ignore
        tools.serverLog(`Webhook signature verification failed: ${err.message}`, "hook_137");
        return res.status(400).json({ code: 400, message: "Webhook signature verification failed" });
    }

    try {
        const result = await processWebhookEvent(event);

        if (result.success) {
            if (result.handled === false) {
                return res.status(200).json({ code: 200, message: "Webhook received but not handled", eventType: event.type });
            }
            if (result.duplicate) {
                return res.status(200).json({ code: 200, message: "Webhook already processed", eventType: event.type });
            }
            return res.status(200).json({ code: 200, message: "Webhook processed successfully", eventType: event.type });
        } else {
            tools.serverLog(`Webhook processing failed: ${result.error}`, "hook_138");
            return res.status(500).json({ code: 500, message: "Webhook processing failed" });
        }

    } catch (error) {
        tools.serverLog(`Unexpected error processing webhook: ${error}`, "hook_139");
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
            `INSERT INTO stripe_events (event_id, event_type) VALUES (?, ?)`,
            [event.id, event.type]
        );
    } catch (dupError) {
        // Duplicate key means this event was already handled
        tools.serverLog(`Duplicate webhook event skipped: ${event.id}`, "hook_4857");
        return { success: true, duplicate: true };
    }

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const metadata = session.metadata || {};

            const sku_variant = metadata.sku_variant;
            const paymentId = metadata.paymentId;
            const userId = metadata.userId;
            const matchId = metadata.matchId;
            const type = session.mode;

            if (!userId || !paymentId || !sku_variant) {
                tools.serverLog('Missing required metadata in checkout.session.completed', "hook_140");
                return { success: false, error: 'Missing required metadata' };
            }

            try {
                if (type === "subscription") {
                    const sessionSubscription = session.subscription;
                    const subscriptionId = typeof sessionSubscription === 'string'
                        ? sessionSubscription
                        : sessionSubscription?.id;

                    if (!subscriptionId) {
                        tools.serverLog('Missing subscription ID for subscription checkout', "hook_141");
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
                            tools.serverLog(`Stripe subscription retrieve attempt ${attempt} failed: ${stripeError}`, "hook_142");
                            if (attempt === maxRetries) {
                                return { success: false, error: 'Failed to retrieve subscription details' };
                            }
                            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                        }
                    }

                    // Stripe moved current_period_start/end from the Subscription object onto its
                    // subscription items in recent API versions — read from there, not the top level.
                    // @ts-ignore
                    const startsAt = subscription_details?.items?.data?.[0]?.current_period_start ?? 0;
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
                        tools.serverLog(`Subscription created successfully: ${genId}`, "hook_897");
                        return { success: true };

                    } catch (dbError) {
                        await connection.rollback();
                        tools.serverLog(`Database transaction failed for subscription: ${dbError}`, "hook_489");
                        return { success: false, error: 'Database error creating subscription' };
                    } finally {
                        connection.release();
                    }

                } else if (type === "payment") {
                    await updatePaymentStatus(paymentId, 'completed', session.id);
                    tools.serverLog(`One-time payment completed: ${paymentId}`, "hook_8997");

                    // Fulfillment is best-effort and isolated from the outer catch: the webhook
                    // event is already deduped by event_id at this point, so letting an error
                    // escape here would mark the payment completed but never retry the grant.
                    try {
                        await fulfillOnetimePurchase(sku_variant, userId, paymentId, matchId);
                    } catch (fulfillError) {
                        tools.serverLog(`Error fulfilling one-time purchase for payment ${paymentId}: ${fulfillError}`, "hook_9002");
                    }

                    return { success: true };
                }

            } catch (error) {
                tools.serverLog(`Error processing checkout.session.completed: ${error}`, "hook_0857");
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
                tools.serverLog('Missing subscription ID in invoice.payment_succeeded', "hook_121");
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
                            tools.serverLog(`Stripe subscription retrieve attempt ${attempt} failed: ${stripeError}`, "hook_122");
                            if (attempt === maxRetries) {
                                await connection.rollback();
                                return { success: false, error: 'Failed to retrieve subscription details' };
                            }
                            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                        }
                    }

                    // @ts-ignore
                    const newEndDate = subscription_details?.items?.data?.[0]?.current_period_end ?? 0;

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
                    tools.serverLog(`Subscription renewed successfully: ${subscriptionId}`, "hook_123");
                    return { success: true };

                } catch (dbError) {
                    await connection.rollback();
                    tools.serverLog(`Database transaction failed for invoice payment succeeded: ${dbError}`, "hook_124");
                    return { success: false, error: 'Database error updating subscription' };
                } finally {
                    connection.release();
                }

            } catch (error) {
                tools.serverLog(`Error processing invoice.payment_succeeded: ${error}`, "hook_125");
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
                tools.serverLog('Missing subscription ID in invoice.payment_failed', "hook_126");
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
                        `INSERT INTO logs_application (report_id, report_type, report_data, report_status, report_currentuser)
                         SELECT ?, 'payment_failed', ?, 0, s.user_id
                         FROM subscriptions s WHERE s.external_id = ?
                         LIMIT 1`,
                        [genReportId, reportData, subscriptionId]
                    );

                    await connection.commit();
                    tools.serverLog(`Subscription payment failed: ${subscriptionId}, status: ${newStatus}`, "hook_127");
                    return { success: true };

                } catch (dbError) {
                    await connection.rollback();
                    tools.serverLog(`Database transaction failed for invoice payment failed: ${dbError}`, "hook_128");
                    return { success: false, error: 'Database error updating subscription status' };
                } finally {
                    connection.release();
                }

            } catch (error) {
                tools.serverLog(`Error processing invoice.payment_failed: ${error}`, "hook_129");
                return { success: false, error: 'Processing error' };
            }
        }

        case "customer.subscription.updated": {
            const subscription = event.data.object;
            const subscriptionId = subscription.id;
            const newCancelFlag = subscription.cancel_at_period_end ? 1 : 0;
            // Stripe statuses we track locally: trialing=4, active=1, past_due=2, canceled=3.
            // Others (unpaid/incomplete/paused) are left untouched rather than guessed at.
           /** @type any */
            const STRIPE_TO_LOCAL_STATUS = { trialing: 4, active: 1, past_due: 2, canceled: 3 };
            const mappedStatus = STRIPE_TO_LOCAL_STATUS[subscription.status] ?? null;

            try {
                /** @type any */
                const [existingRows] = await db_pool.query(
                    `SELECT cancel_at_period_end FROM subscriptions WHERE external_id = ? LIMIT 1`,
                    [subscriptionId]
                );
                const wasAlreadyFlagged = Boolean(existingRows?.[0]?.cancel_at_period_end);
                const justTransitioned = newCancelFlag === 1 && !wasAlreadyFlagged;

                await db_pool.query(
                    `UPDATE subscriptions
                     SET cancel_at_period_end = ?,
                         canceled_at = ${justTransitioned ? 'NOW()' : 'canceled_at'}
                         ${mappedStatus ? ', status = ?' : ''}
                     WHERE external_id = ?`,
                    mappedStatus
                        ? [newCancelFlag, mappedStatus, subscriptionId]
                        : [newCancelFlag, subscriptionId]
                );

                tools.serverLog(`Subscription updated: ${subscriptionId}, cancel_at_period_end=${Boolean(newCancelFlag)}`, "hook_130");
                return { success: true };

            } catch (error) {
                tools.serverLog(`Error processing customer.subscription.updated: ${error}`, "hook_131");
                return { success: false, error: 'Database error updating subscription' };
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

                tools.serverLog(`Subscription cancelled: ${subscriptionId}`, "hook_132");
                return { success: true };

            } catch (error) {
                tools.serverLog(`Error processing customer.subscription.deleted: ${error}`, "hook_133");
                return { success: false, error: 'Database error cancelling subscription' };
            }
        }

        default:
            tools.serverLog(`Unhandled webhook event: ${event.type}`, "hook_134");
            return { success: true, handled: false };
    }
}

/**
 * Grants whatever a purchased one-time product variant represents:
 * - `superlike`-category variants (rose packs), described as `{"roses": <quantity>}`
 * - `rewind`-category: "buy once, rewind once" — no balance is kept; the purchase
 *   directly performs the rewind on the match named by `matchId` (see pay.js's onetime
 *   handler, which requires matchId for this category and threads it through Stripe
 *   metadata to get here).
 * @param {string} variantId
 * @param {string} userId
 * @param {string} paymentId
 * @param {string} [matchId]
 */
export async function fulfillOnetimePurchase(variantId, userId, paymentId, matchId) {
    /** @type {[any[], any]} */
    const [variantRows] = await db_pool.query(
        `SELECT pv.description, pl.category
         FROM product_list_variant pv
         INNER JOIN product_lists pl ON pl.pl_sku = pv.product_lists_id_ref
         WHERE pv.id_ai = ? LIMIT 1`,
        [variantId]
    );
    const variant = variantRows?.[0];
    if (!variant) return;

    const description = typeof variant.description === 'string' ? JSON.parse(variant.description) : variant.description;

    if (variant.category === 'superlike') {
        const roses = Number(description?.roses ?? 0);
        if (!Number.isFinite(roses) || roses <= 0) return;

        // Upsert: the user may never have spent a rose before, so their row in
        // user_rose_usage might not exist yet.
        await db_pool.query(
            `INSERT INTO user_rose_usage (user_id, rose_balance, daily_used, daily_reset_date)
             VALUES (?, ?, 0, CURRENT_DATE)
             ON DUPLICATE KEY UPDATE rose_balance = rose_balance + ?`,
            [userId, roses, roses]
        );
        tools.serverLog(`Granted ${roses} roses to user ${userId} for payment ${paymentId}`, "hook_9001");
        return;
    }

    if (variant.category === 'rewind') {
        if (!matchId) {
            tools.serverLog(`Rewind purchase completed with no matchId for payment ${paymentId}`, "hook_9004");
            return;
        }

        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [result] = await db_pool.query(
            `UPDATE matches SET match_status = '0' WHERE match_id = ? AND match_user_id_to = ? AND match_status = '2'`,
            [matchId, userId]
        );
        if (result.affectedRows === 0) {
            tools.serverLog(`Rewind purchase completed but match ${matchId} was no longer rewindable for payment ${paymentId}`, "hook_9005");
            return;
        }
        tools.serverLog(`Rewound match ${matchId} for user ${userId} for payment ${paymentId}`, "hook_9003");
    }
}

// payments.status tinyint: 0=pending, 1=completed, 2=refunded, 3=failed
const PAYMENT_STATUS = { pending: 0, completed: 1, refunded: 2, failed: 3 };

/**
 * @param {string} paymentId
 * @param {'pending'|'completed'|'refunded'|'failed'} statusKey
 * @param {string} [transactionReference]
 */
export async function updatePaymentStatus(paymentId, statusKey, transactionReference) {
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
        tools.serverLog(`Failed to update payment status for ${paymentId}:`, "hook_4257");
        throw error;
    }
}

export default webhook_router;
