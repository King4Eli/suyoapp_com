import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { payments, userPaymentNotices } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { getNoticeForPayment } from "../../global/paymentNotices.js";

// payments.status -> what the checkout-return screen should do with it.
/** @type {Record<number, string>} */
const STATUS_NAMES = {
  0: "pending",
  1: "completed",
  2: "refunded",
  3: "failed",
  4: "expired",
  5: "processing",
};

/**
 * Outcome of one of the caller's payments, polled by the app after returning from
 * checkout. `notice` is the event-specific message (e.g. "Welcome to Plus!") once
 * the webhook has processed it; it's marked seen here so it isn't shown twice.
 * @param {{ paymentId?: string }} data
 */
export default async function getPaymentStatus(data) {
  /** @type {any} */
  const response = { code: 404, message: "Payment not found." };
  try {
    const paymentId = String(data?.paymentId ?? "");
    if (!paymentId) return response;
    const [payment] = await db
      .select({ status: payments.status, type: payments.type })
      .from(payments)
      .where(
        and(
          eq(payments.paymentId, paymentId),
          eq(payments.userIdRef, sessions.currentUserID),
        ),
      )
      .limit(1);
    if (!payment) return response;

    const notice = await getNoticeForPayment(sessions.currentUserID, paymentId);
    if (notice) {
      await db
        .update(userPaymentNotices)
        .set({ seen: 1 })
        .where(eq(userPaymentNotices.id, notice.id));
    }
    response.code = 200;
    response.message = "ok";
    response.status = STATUS_NAMES[Number(payment.status)] ?? "pending";
    response.kind = Number(payment.type) === 1 ? "subscription" : "onetime";
    response.notice = notice;
  } catch (err) {
    tools.serverLog(`Error in getPaymentStatus: ${err}`, "getPaymentStatus-1");
    response.code = 500;
    response.message = "Couldn't check your payment. Please try again.";
  }
  return response;
}
