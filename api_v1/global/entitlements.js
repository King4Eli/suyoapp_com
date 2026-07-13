import db_pool from "./database.js";

/**
 * The caller's current active (paid-through) subscription, or null if none.
 * @param {string} userId
 */
export async function getActiveSubscription(userId) {
    const subscriptionSql = `SELECT
      s.id AS subscription_id,
      s.variant_id_ref,
      s.start_date,
      s.end_date,
      s.external_platform,
      s.external_id,
      s.payment_id_ref,
      s.status,
      s.cancel_at_period_end,
      pv.name AS plan_name,
      pv.description AS plan_description,
      pv.price AS plan_price,
      pv.billing_cycle,
      pl.pl_sku,
      pl.pl_name AS product_name,
      pl.pl_description AS product_description,
      p.payment_id,
      p.status AS payment_status,
      p.p_amount AS payment_amount,
      p.p_currency AS payment_currency
    FROM subscriptions s
    LEFT JOIN product_list_variant pv
      ON s.variant_id_ref = pv.id_ai
    LEFT JOIN product_lists pl
      ON pv.product_lists_id_ref = pl.pl_sku
    LEFT JOIN payments p
      ON s.payment_id_ref = p.payment_id
    WHERE s.user_id = ?
      AND s.status = 1
      AND s.end_date > NOW()
    ORDER BY s.date_created DESC
    LIMIT 1`;

    /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
    const [subRows] = await db_pool.query(subscriptionSql, [userId]);

    if (!Array.isArray(subRows) || subRows.length === 0) {
        return null;
    }

    /** @type {any} */
    const subData = subRows[0];
    return {
        id: subData.subscription_id,
        variant_id: subData.variant_id_ref,
        plan_name: subData.plan_name,
        plan_description: subData.plan_description,
        plan_price: parseFloat(subData.plan_price),
        billing_cycle: subData.billing_cycle,
        product_name: subData.product_name,
        product_description: subData.product_description,
        platform: subData.external_platform,
        external_id: subData.external_id,
        payment_id: subData.payment_id,
        payment_status: subData.payment_status,
        payment_amount: parseFloat(subData.payment_amount),
        payment_currency: subData.payment_currency,
        start_date: subData.start_date,
        end_date: subData.end_date,
        status: 'active',
        cancel_at_period_end: Boolean(subData.cancel_at_period_end),
        days_remaining: Math.max(0, Math.ceil((new Date(subData.end_date)?.getTime() - new Date()?.getTime()) / (1000 * 60 * 60 * 24)))
    };
}
