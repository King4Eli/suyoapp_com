import { db } from "../../db/client.js";
import { userVerifications } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import {
  getVerificationState,
  takeIssuedPose,
} from "../../global/verification.js";

/**
 * Submits a verification selfie for admin review. The selfie must be one this
 * user uploaded to their own verify folder (bucketType "profile-verify"), and
 * the pose must be the one getVerification issued to them.
 * @param {{ selfiePath?: string; pose?: string }} data
 */
export default async function pushVerification(data) {
  /** @type {any} */
  const response = { code: 400, message: "Take your selfie first." };
  try {
    const userId = sessions.currentUserID;
    const selfiePath = String(data?.selfiePath ?? "");
    const escapedId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`^/users/${escapedId}/verify/[\\w.-]+$`).test(selfiePath)) {
      return response;
    }

    const state = await getVerificationState(userId);
    if (state.status === "verified") {
      response.code = 409;
      response.message = "You're already verified.";
      return response;
    }
    if (state.status === "pending") {
      response.code = 409;
      response.message = "Your selfie is already being reviewed.";
      return response;
    }

    const issued = await takeIssuedPose(userId);
    if (!issued || issued !== data?.pose) {
      response.code = 409;
      response.reason = "pose_expired";
      response.message =
        "That pose has expired. Here's a new one -- please take your selfie again.";
      return response;
    }

    await db.insert(userVerifications).values({
      id: tools.generateAlphanumeric(20, 30),
      userId,
      selfiePath,
      pose: issued,
      status: 0,
    });
    response.code = 200;
    response.status = "pending";
    response.message =
      "Thanks! We'll review your selfie shortly -- usually within a day.";
  } catch (err) {
    tools.serverLog(`Error in pushVerification: ${err}`, "pushVerification-1");
    response.code = 500;
    response.message = "Couldn't submit your selfie. Please try again.";
  }
  return response;
}
