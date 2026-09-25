import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { takeUnseenPaymentNotices } from "../../global/paymentNotices.js";

/**
 * Payment events the user hasn't seen yet (renewals, failed payments, refunds...),
 * handed out once each. The app calls this on launch/foreground and when the
 * socket pings "payment-event".
 */
export default async function getPaymentNotices() {
  /** @type {any} */
  const response = { code: 200, message: "ok", notices: [] };
  try {
    response.notices = await takeUnseenPaymentNotices(sessions.currentUserID);
  } catch (err) {
    tools.serverLog(
      `Error in getPaymentNotices: ${err}`,
      "getPaymentNotices-1",
    );
    response.code = 500;
    response.message = "Couldn't load payment updates.";
  }
  return response;
}
