import express from 'express';
import { sessions, tools, stripe_gateway } from '../global/functions.js';
import GatewayPay from './payments/gateway.js';
import db_pool from '../global/database.js';

import fs from 'fs';
const variables = JSON.parse(fs.readFileSync('./global/variables.json', 'utf8'));

const pay_router = express.Router();

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
                const { ot_duration, sku } = req.body;

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
                        onetimePaymentId
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
