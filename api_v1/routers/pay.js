import express from 'express';
import { sessions, tools, stripe_gateway } from '../global/functions.js';
import GatewayPay from './payments/gateway.js';
import db_pool from '../global/database.js';
import { fulfillOnetimePurchase } from './payments/router_hook.js';
import { verifyAppleTransaction, verifyGooglePurchase } from '../global/iapVerify.js';

import fs from 'fs';
const variables = JSON.parse(fs.readFileSync('./global/variables.json', 'utf8'));

const pay_router = express.Router();

// subscriptions.external_platform: 1=stripe,2=apple,3=google
const IAP_PLATFORM_CODE = { apple: 2, google: 3 };

// Fallback when the store doesn't hand back an expiry (e.g. pseudo-mode Google one-time
// lookups don't have one); mirrors gateway.js's billing_cycle semantics in days instead of
// Stripe's {interval,interval_count} shape.
function daysForBillingCycle(cycle) {
    return { 2: 7, 3: 14, 4: 30, 5: 365 }[cycle] ?? null;
}

pay_router.post('/:division', async (req, res) => {
    const { division } = req.params;

    const headers = req.headers;
    // if division !== "webhook" doesnt require auth

    const auth_token = Array.isArray(headers['x-omi-auth']) ? headers['x-omi-auth'][0] : (headers['x-omi-auth'] ?? "");
    const auth_hash = Array.isArray(headers['x-omi-hash']) ? headers['x-omi-hash'][0] : (headers['x-omi-hash'] ?? "");

    const sessionValidation = sessions.verifyFullSession(auth_token, auth_hash);
    if (!sessionValidation.status) {
        return res.status(sessionValidation.code).json({ code: sessionValidation.code, message: sessionValidation.message });
    }

    try {
        switch (division) {
            case 'subscribe':
                const { s_duration_int, s_sku } = req.body;

                // Validate required parameters
                if (!s_duration_int || !s_sku) {
                    return res.status(400).json({ code: 400, message: "Missing required parameters: s_duration_int and s_sku are required." });
                }

                // Fetch product details with retry logic
                /** @type any */
                let productData = [];
                try {
                    const [rows] = await db_pool.query(
                        `SELECT
                            pl.pl_sku,
                            pl.pl_name,
                            pl.pl_description,
                            pl.category,
                            pv.id_ai AS variant_id,
                            pv.description AS variant_description,
                            pv.price,
                            pv.billing_cycle,
                            pv.external_3rdparty_store_product_id,
                            u.user_email
                        FROM product_lists pl
                        INNER JOIN product_list_variant pv
                            ON pv.product_lists_id_ref = pl.pl_sku
                        INNER JOIN users u
                            ON u.user_id = ?
                        WHERE pl.pl_is_active = '1'
                          AND pv.active = '1'
                          AND (pl.pl_sku = ?  )
                          AND pv.id_ai = ?
                        LIMIT 1`,
                        [sessions?.currentUserID, s_sku, s_duration_int]
                    );
                    productData = rows;
                } catch (dbError) {
                    return res.status(500).json({ code: 500, message: "Database error occurred. Please try again later." });

                }

                if (!productData?.[0]) {
                    return res.status(404).json({ code: 404, message: "Product not found or inactive." });
                }

                const product = productData?.[0];
                const v_price = product.price;

                // Validate price
                if (!v_price || v_price <= 0) {
                    return res.status(400).json({ code: 400, message: "Invalid product price." });
                }

                // Generate payment ID
                const gen_payment_id = `pay${tools.generateAlphanumeric(10, tools.randomInt(15, 46))}`;

                // Insert payment record with transaction
                const connection = await db_pool.getConnection();
                try {
                    await connection.beginTransaction();

                    const [insertResult] = await connection.query(
                        `INSERT INTO payments
                        (user_id_ref, payment_id, type, p_amount, p_currency, variant_ref, status)
                        VALUES
                        (?, ?, 1, ?, ?, ?, 0)`,
                        [sessions?.currentUserID, gen_payment_id, v_price, "USD", s_duration_int]
                    );

                    // Create Stripe session
                    const sub = await GatewayPay.subscribe(
                        req.get("host"),
                        s_sku,
                        s_duration_int,
                        product.user_email,
                        product.pl_name,
                        product.billing_cycle,
                        v_price,
                        gen_payment_id
                    );

                    if (sub.code === 301) {
                        await connection.commit();
                        return res.json(sub);
                    } else {
                        await connection.rollback();
                        return res.status(sub.code).json({ code: sub.code, message: sub.message });
                    }
                } catch (error) {
                    await connection.rollback(); 
                    tools.serverLog(`Payment transaction failed for user ${sessions?.currentUserID}: ${error  }` );
                    return res.status(500).json({ code: 500, message: "Payment initialization failed. Please try again." });
                } finally {
                    connection.release();
                }

            case 'onetime':
                const { ot_duration, sku, matchId: onetimeMatchId } = req.body;

                // Validate required parameters
                if (!ot_duration || !sku) {
                    return res.status(400).json({ code: 400, message: "Missing required parameters: ot_duration and sku are required." });
                }

                // Fetch product details
                /** @type any */
                let onetimeProductData = [];
                try {
                    const [rows] = await db_pool.query(
                        `SELECT
                            pl.pl_sku,
                            pl.pl_name,
                            pl.pl_description,
                            pl.category,
                            pv.id_ai AS variant_id,
                            pv.description AS variant_description,
                            pv.price,
                            pv.billing_cycle,
                            pv.external_3rdparty_store_product_id,
                            u.user_email
                        FROM product_lists pl
                        INNER JOIN product_list_variant pv
                            ON pv.product_lists_id_ref = pl.pl_sku
                        INNER JOIN users u
                            ON u.user_id = ?
                        WHERE pl.pl_is_active = '1'
                          AND pv.active = '1'
                          AND (pl.pl_sku = ?  )
                          AND pv.id_ai = ?
                        LIMIT 1`,
                        [sessions?.currentUserID, sku, ot_duration]
                    );
                    onetimeProductData = rows;

                } catch (dbError) {
                    return res.status(500).json({ code: 500, message: "Database error occurred. Please try again later." });
                }

                if (!onetimeProductData?.[0]) {
                    return res.status(404).json({ code: 404, message: "Product not found or inactive." });
                }

                const onetimeProduct = onetimeProductData[0];
                const onetimePrice = onetimeProduct.price;

                if (!onetimePrice || onetimePrice <= 0) {
                    return res.status(400).json({ code: 400, message: "Invalid product price." });
                }

                // Rewind is "buy once, rewind once" — the purchase must say which match it applies
                // to so the webhook can perform the rewind directly on payment completion.
                if (onetimeProduct.category === 'rewind' && !onetimeMatchId) {
                    return res.status(400).json({ code: 400, message: "Missing matchId for rewind purchase." });
                }

                // Generate payment ID
                const onetimePaymentId = `pay${tools.generateAlphanumeric(10, tools.randomInt(15, 46))}`;

                // Insert payment record
                const onetimeConnection = await db_pool.getConnection();
                try {
                    await onetimeConnection.beginTransaction();

                    await onetimeConnection.query(
                        `INSERT INTO payments
                        (user_id_ref, payment_id, type, p_amount, p_currency, variant_ref, status)
                        VALUES
                        (?, ?, 2, ?, ?, ?, 0)`,
                        [sessions?.currentUserID, onetimePaymentId, onetimePrice, "USD", ot_duration]
                    );

                    // Create one-time payment session
                    const onetimeResult = await GatewayPay.onetime(
                        req.get("host"),
                        sku,
                        ot_duration,
                        onetimeProduct.user_email,
                        onetimeProduct.pl_name,
                        onetimeProduct.billing_cycle,
                        onetimePrice,
                        onetimePaymentId,
                        onetimeMatchId
                    );

                    if (onetimeResult.code === 301) {
                        await onetimeConnection.commit();
                        return res.json(onetimeResult);
                    } else {
                        await onetimeConnection.rollback();
                        return res.status(onetimeResult.code).json({ code: onetimeResult.code, message: onetimeResult.message });
                    }
                } catch (error) {
                    await onetimeConnection.rollback();
                    tools.serverLog(`One-time payment transaction failed for user ${sessions?.currentUserID}: ${error  }` );
                     return res.status(500).json({ code: 500, message: "One-time payment initialization failed. Please try again." });
                } finally {
                    onetimeConnection.release();
                }

            case 'cancel-subscription': {
                const { subscriptionId } = req.body;

                if (!subscriptionId) {
                    return res.status(400).json({ code: 400, message: "Missing required parameter: subscriptionId." });
                }

                /** @type any */
                let subRows = [];
                try {
                    const [rows] = await db_pool.query(
                        `SELECT id, user_id, external_id, status, cancel_at_period_end
                         FROM subscriptions
                         WHERE id = ?
                         LIMIT 1`,
                        [subscriptionId]
                    );
                    subRows = rows;
                } catch (dbError) {
                    return res.status(500).json({ code: 500, message: "Database error occurred. Please try again later." });
                }

                const subscriptionRow = subRows?.[0];

                if (!subscriptionRow || subscriptionRow.user_id !== sessions?.currentUserID) {
                    return res.status(404).json({ code: 404, message: "Subscription not found." });
                }

                if (subscriptionRow.status !== 1) {
                    return res.status(400).json({ code: 400, message: "Only active subscriptions can be cancelled." });
                }

                if (subscriptionRow.cancel_at_period_end) {
                    return res.status(400).json({ code: 400, message: "This subscription is already scheduled to cancel." });
                }

                try {
                    await stripe_gateway.subscriptions.update(subscriptionRow.external_id, { cancel_at_period_end: true });
                } catch (stripeError) {
                    tools.serverLog(`Stripe cancel-subscription failed for ${subscriptionId}: ${stripeError}`, "pay-cancel-0");
                    return res.status(502).json({ code: 502, message: "Unable to reach the payment provider. Please try again." });
                }

                try {
                    await db_pool.query(
                        `UPDATE subscriptions SET cancel_at_period_end = 1, canceled_at = NOW() WHERE id = ?`,
                        [subscriptionId]
                    );
                } catch (dbError) {
                    tools.serverLog(`Local cancel-subscription update failed for ${subscriptionId}: ${dbError}`, "pay-cancel-1");
                    return res.status(500).json({ code: 500, message: "Cancellation was recorded with the payment provider, but failed to save locally. Please contact support." });
                }

                return res.json({ code: 200, message: "Subscription will be cancelled at the end of the current billing period.", subscriptionId, cancel_at_period_end: true });
            }

            case 'iap-verify': {
                const { purchaseType, platform, sku, variantId, productId, transactionId, purchaseToken, matchId: iapMatchId } = req.body;

                if (!['subscribe', 'onetime'].includes(purchaseType) || !IAP_PLATFORM_CODE[platform] || !sku || !variantId || !productId || !transactionId || !purchaseToken) {
                    return res.status(400).json({ code: 400, message: "Missing or invalid required parameters for IAP verification." });
                }

                /** @type any */
                let variantRows = [];
                try {
                    const [rows] = await db_pool.query(
                        `SELECT pl.pl_sku, pl.category, pv.id_ai AS variant_id, pv.price, pv.billing_cycle, pv.external_3rdparty_store_product_id
                         FROM product_lists pl
                         INNER JOIN product_list_variant pv ON pv.product_lists_id_ref = pl.pl_sku
                         WHERE pl.pl_is_active = '1' AND pv.active = '1' AND pl.pl_sku = ? AND pv.id_ai = ?
                         LIMIT 1`,
                        [sku, variantId]
                    );
                    variantRows = rows;
                } catch (dbError) {
                    return res.status(500).json({ code: 500, message: "Database error occurred. Please try again later." });
                }

                const variant = variantRows?.[0];
                if (!variant) {
                    return res.status(404).json({ code: 404, message: "Product not found or inactive." });
                }
                if (variant.external_3rdparty_store_product_id !== productId) {
                    tools.serverLog(`IAP productId mismatch: client sent ${productId}, expected ${variant.external_3rdparty_store_product_id}`, "pay-iap-0");
                    return res.status(400).json({ code: 400, message: "Product identifier does not match this store listing." });
                }
                if (variant.category === 'rewind' && !iapMatchId) {
                    return res.status(400).json({ code: 400, message: "Missing matchId for rewind purchase." });
                }

                // Idempotent: the client may resend the same transaction (e.g. app relaunch before
                // finishTransaction runs), in which case this insert fails and we short-circuit.
                try {
                    await db_pool.query(
                        `INSERT INTO iap_transactions
                        (transaction_id, platform, product_id, variant_id_ref, user_id_ref, match_id_ref, status)
                        VALUES (?, ?, ?, ?, ?, ?, 0)`,
                        [transactionId, IAP_PLATFORM_CODE[platform], productId, variantId, sessions?.currentUserID, iapMatchId ?? null]
                    );
                } catch (dupError) {
                    /** @type any */
                    const [existingRows] = await db_pool.query(
                        `SELECT status, payment_id_ref FROM iap_transactions WHERE transaction_id = ? LIMIT 1`,
                        [transactionId]
                    );
                    const existing = existingRows?.[0];
                    if (existing?.status === 1) {
                        return res.json({ code: 200, message: "Purchase already verified.", paymentId: existing.payment_id_ref });
                    }
                    return res.status(409).json({ code: 409, message: "This transaction is already being processed." });
                }

                let verification;
                try {
                    verification = platform === 'apple'
                        ? await verifyAppleTransaction(transactionId, purchaseToken)
                        : await verifyGooglePurchase(productId, purchaseToken, purchaseType === 'subscribe');
                } catch (verifyError) {
                    tools.serverLog(`IAP verification failed for transaction ${transactionId}: ${verifyError}`, "pay-iap-1");
                    await db_pool.query(`UPDATE iap_transactions SET status = 2 WHERE transaction_id = ?`, [transactionId]);
                    return res.status(502).json({ code: 502, message: "Unable to verify this purchase with the store. Please try again." });
                }

                if (verification.productId !== productId) {
                    tools.serverLog(`IAP verified productId ${verification.productId} does not match requested ${productId}`, "pay-iap-2");
                    await db_pool.query(`UPDATE iap_transactions SET status = 2 WHERE transaction_id = ?`, [transactionId]);
                    return res.status(400).json({ code: 400, message: "Store verification returned a different product." });
                }

                const isExpired = purchaseType === 'subscribe' && verification.expiresAtMs && verification.expiresAtMs < Date.now();
                const isInactive = purchaseType === 'subscribe' && verification.isActive === false;
                if (isExpired || isInactive) {
                    tools.serverLog(`IAP subscription not active for transaction ${transactionId}`, "pay-iap-5");
                    await db_pool.query(`UPDATE iap_transactions SET status = 2 WHERE transaction_id = ?`, [transactionId]);
                    return res.status(400).json({ code: 400, message: "This subscription is not currently active." });
                }

                const genPaymentId = `pay${tools.generateAlphanumeric(10, tools.randomInt(15, 46))}`;
                const connection = await db_pool.getConnection();
                try {
                    await connection.beginTransaction();

                    await connection.query(
                        `INSERT INTO payments
                        (user_id_ref, payment_id, type, p_amount, p_currency, variant_ref, status, p_transaction_reference)
                        VALUES (?, ?, ?, ?, 'USD', ?, 1, ?)`,
                        [sessions?.currentUserID, genPaymentId, purchaseType === 'subscribe' ? 1 : 2, variant.price, variantId, transactionId]
                    );

                    if (purchaseType === 'subscribe') {
                        const genSubId = tools.generateAlphanumeric(10, tools.randomInt(20, 50));
                        const expiresAtMs = verification.expiresAtMs ?? (() => {
                            const days = daysForBillingCycle(variant.billing_cycle);
                            return days ? Date.now() + days * 24 * 60 * 60 * 1000 : null;
                        })();
                        if (!expiresAtMs) {
                            throw new Error('Unable to determine subscription expiry');
                        }

                        await connection.query(
                            `INSERT INTO subscriptions
                            (id, user_id, variant_id_ref, start_date, end_date, external_platform, external_id, payment_id_ref, status)
                            VALUES (?, ?, ?, NOW(), FROM_UNIXTIME(?), ?, ?, ?, 1)`,
                            [genSubId, sessions?.currentUserID, variantId, Math.floor(expiresAtMs / 1000), IAP_PLATFORM_CODE[platform], verification.originalTransactionId ?? transactionId, genPaymentId]
                        );
                    }

                    await connection.query(
                        `UPDATE iap_transactions
                         SET status = 1, payment_id_ref = ?, verification_mode = ?, verification_response = ?
                         WHERE transaction_id = ?`,
                        [genPaymentId, verification.mode === 'verified' ? 1 : 0, JSON.stringify(verification.raw ?? {}), transactionId]
                    );

                    await connection.commit();
                } catch (error) {
                    await connection.rollback();
                    tools.serverLog(`IAP fulfillment transaction failed for ${transactionId}: ${error}`, "pay-iap-3");
                    return res.status(500).json({ code: 500, message: "Failed to record this purchase. Please contact support." });
                } finally {
                    connection.release();
                }

                if (purchaseType === 'onetime') {
                    try {
                        await fulfillOnetimePurchase(variantId, sessions?.currentUserID, genPaymentId, iapMatchId);
                    } catch (fulfillError) {
                        tools.serverLog(`Error fulfilling IAP one-time purchase for payment ${genPaymentId}: ${fulfillError}`, "pay-iap-4");
                    }
                }

                return res.json({ code: 200, message: "Purchase verified.", paymentId: genPaymentId, verified: verification.mode === 'verified' });
            }

            default:
                return res.status(400).json({ code: 400, message: "Invalid payment type. Supported: subscribe, onetime" });
        }
    } catch (error) {
        tools.serverLog(`Unexpected error in payment processing for user ${sessions?.currentUserID}: ${error  }` );
         return res.status(500).json({ code: 500, message: "An unexpected error occurred. Please try again later." });
    }
});

pay_router.get('/success', async (req, res) => {
    return res.redirect(variables.site.hotlink_payment_200);
});

pay_router.get('/cancel', async (req, res) => {
    return res.redirect(variables.site.hotlink_payment_400);
});






export default pay_router;
