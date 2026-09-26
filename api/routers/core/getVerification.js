import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import {
  VERIFICATION_POSES,
  getVerificationState,
  issuePose,
} from "../../global/verification.js";

/**
 * The caller's verification state, plus the pose to copy when they can
 * (re)submit -- i.e. not already verified and nothing under review.
 */
export default async function getVerification() {
  /** @type {any} */
  const response = { code: 200, message: "ok" };
  try {
    const state = await getVerificationState(sessions.currentUserID);
    Object.assign(response, state);
    if (state.status === "none" || state.status === "rejected") {
      const code = await issuePose(sessions.currentUserID);
      // @ts-ignore
      response.pose = { code, ...VERIFICATION_POSES[code] };
    }
  } catch (err) {
    tools.serverLog(`Error in getVerification: ${err}`, "getVerification-1");
    response.code = 500;
    response.message = "Couldn't load your verification status.";
  }
  return response;
}
