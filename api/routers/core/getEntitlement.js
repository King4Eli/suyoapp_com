import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { getActiveSubscription } from "../../global/entitlements.js";

/**
 * Lightweight entitlement snapshot, meant to be polled by the frontend right
 * after a purchase / deep link return, without refetching the whole profile.
 */
export default async function getEntitlement() {
  /** @type {any} */
  const response = {
    code: 200,
    message: "ok",
    subscription: null,
    hasActiveSubscription: false,
  };
  try {
    const subscription = await getActiveSubscription(sessions.currentUserID);
    response.subscription = subscription;
    response.hasActiveSubscription = subscription !== null;
  } catch (err) {
    tools.serverLog(`Error in getEntitlement: ${err}`, "getEntitlement-0");
    response.code = 500;
    response.message = "Error refreshing entitlement.";
  }
  return response;
}
