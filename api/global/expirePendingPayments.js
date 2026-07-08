import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { payments } from "../db/schema.js";
import { tools, envInt } from "./functions.js";

const HOUR_MS = 60 * 60 * 1000;
const PENDING_TTL_HOURS = envInt("PENDING_PAYMENTS_TTL_HOURS", 24);

async function expireStalePendingPayments() {
  try {
    const [result] = await db
      .update(payments)
      .set({ status: 4 })
      .where(
        and(
          eq(payments.status, 0),
          lt(
            payments.pCreatedAt,
            sql`NOW() - INTERVAL ${PENDING_TTL_HOURS} HOUR`,
          ),
        ),
      );
    if (result?.affectedRows) {
      tools.serverLog(
        `Expired ${result.affectedRows} stale pending payment(s).`,
        "expirePendingPayments-0",
      );
    }
  } catch (err) {
    tools.serverLog(
      `Error expiring stale pending payments: ${err}`,
      "expirePendingPayments-1",
    );
  }
}

export function startExpirePendingPaymentsJob() {
  expireStalePendingPayments();
  setInterval(expireStalePendingPayments, HOUR_MS);
}
