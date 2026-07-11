import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";

export default async function getPaymentHistory() {
    /** @type { any } */
    const response = { code: 404, message: "No payment history found." };
    const sql = `
        SELECT p.payment_id, p.p_amount, p.p_currency, p.type, p.status, p.p_created_at,
               pl.pl_name AS product_name, pv.name AS plan_name
        FROM payments p
        LEFT JOIN product_list_variant pv ON p.variant_ref = pv.id_ai
        LEFT JOIN product_lists pl ON pv.product_lists_id_ref = pl.pl_sku
        WHERE p.user_id_ref = ?
        ORDER BY p.p_created_at DESC
        LIMIT 100
    `;
    try {
        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [rows] = await db_pool.query(sql, [sessions.currentUserID]);
        // @ts-ignore
        const history = rows.map(row => ({
            paymentId: row.payment_id,
            amount: parseFloat(row.p_amount),
            currency: row.p_currency,
            type: Number(row.type) === 1 ? 'subscription' : 'onetime',
            status: Number(row.status),
            productName: row.product_name,
            planName: row.plan_name,
            createdAt: row.p_created_at
        }));
        response.code = 200;
        response.message = "ok";
        response.history = history;
    }
    catch (err) {
        tools.serverLog(`Error in getPaymentHistory: ${err}`, "getPaymentHistory-0");
        response.code = 500;
        response.message = "Database error.";
    }
    return response;
}
