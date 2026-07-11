import db_pool from "./database.js";
import { tools } from "./functions.js";

const HOUR_MS = 60 * 60 * 1000;
const PENDING_TTL_HOURS = 24;

async function expireStalePendingPayments() {
    try {
        const [result] = await db_pool.query(
            `UPDATE payments SET status = 4
             WHERE status = 0 AND p_created_at < NOW() - INTERVAL ? HOUR`,
            [PENDING_TTL_HOURS]
        );
        // @ts-ignore
        if (result?.affectedRows) {
            // @ts-ignore
            tools.serverLog(`Expired ${result.affectedRows} stale pending payment(s).`, "expirePendingPayments-0");
        }
    } catch (err) {
        tools.serverLog(`Error expiring stale pending payments: ${err}`, "expirePendingPayments-1");
    }
}

export function startExpirePendingPaymentsJob() {
    expireStalePendingPayments();
    setInterval(expireStalePendingPayments, HOUR_MS);
}
