import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { namer, tools, envInt } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { redisDo } from "../../global/redisClient.js";
import { communicateWith } from "../../global/sendingCommunicate.js";
import { checkRateLimit } from "../../global/rateLimit.js";
/**
 * @param {any} oldPhoneNumber
 * @param {string | undefined} newPhoneNumber
 * @param {any} requestNewCode
 * @param {string | undefined} verificationCode
 */
export default async function pushNewPhoneNumber(
  oldPhoneNumber,
  newPhoneNumber,
  requestNewCode,
  verificationCode,
) {
  const response = { code: 400, message: "Invalid request." };
  oldPhoneNumber = (oldPhoneNumber ?? "").trim().toLowerCase();
  newPhoneNumber = (newPhoneNumber ?? "").trim().toLowerCase();
  verificationCode = (verificationCode ?? "").trim().toLowerCase();
  if (!tools.validateIsNumber(newPhoneNumber)) {
    response.code = 400;
    response.message = "Invalid phone number.";
    return response;
  }
  try {
    if (requestNewCode) {
      const otpRequestLimit = await checkRateLimit(
        `${namer.ratelimit.phonechange_otp_request}${sessions.currentUserID}`,
        envInt("PHONECHANGE_OTP_REQUEST_LIMIT", 5),
        envInt("PHONECHANGE_OTP_REQUEST_WINDOW_SECONDS", 600),
      );
      if (!otpRequestLimit.allowed) {
        response.code = 429;
        response.message = "Too many codes requested. Please try again later.";
        return response;
      }

      const rows = await db
        .select({ user_id: users.userId })
        .from(users)
        .where(eq(users.userPhonenumber, newPhoneNumber))
        .limit(1);

      if (Array.isArray(rows) && rows.length > 0) {
        response.code = 400;
        response.message = "Phone Number already exists.";
      } else {
        const genPinCode = Math.floor(Math.random() * 900000) + 100000;
        const ttlSeconds = envInt("PHONECHANGE_OTP_CODE_TTL_SECONDS", 300);
        const ttlMinutes = Math.round(ttlSeconds / 60);
        await communicateWith.sendSms(
          "1",
          newPhoneNumber,
          `Your verification code is ${genPinCode}. Do not share this code with anyone. It expires in ${ttlMinutes} minutes.`,
        );
        await redisDo(async (client) => {
          await client.set(
            `${namer.redis.verifyCode}phone:${sessions.currentUserID}`,
            genPinCode,
          );
          await client.expire(
            `${namer.redis.verifyCode}phone:${sessions.currentUserID}`,
            ttlSeconds,
          );
        });
        response.code = 200;
        response.message = "Verification code sent to your new number.";
      }
    } else if (tools.validateIsNumber(verificationCode)) {
      const otpVerifyLimit = await checkRateLimit(
        `${namer.ratelimit.phonechange_otp_verify}${sessions.currentUserID}`,
        envInt("PHONECHANGE_OTP_VERIFY_LIMIT", 10),
        envInt("PHONECHANGE_OTP_VERIFY_WINDOW_SECONDS", 600),
      );
      if (!otpVerifyLimit.allowed) {
        response.code = 429;
        response.message = "Too many attempts. Please try again later.";
        return response;
      }

      const codeIsValid = await redisDo(async (client) => {
        const code = await client.get(
          `${namer.redis.verifyCode}phone:${sessions.currentUserID}`,
        );
        const isValid = code === verificationCode;
        if (isValid) {
          await client.del(
            `${namer.redis.verifyCode}phone:${sessions.currentUserID}`,
          );
        }
        return isValid;
      });
      if (!codeIsValid) {
        response.code = 400;
        response.message = "Wrong or expired code.";
        return response;
      }

      const [result] = await db
        .update(users)
        .set({ userPhonenumber: newPhoneNumber })
        .where(
          and(
            eq(users.userId, sessions.currentUserID),
            eq(users.userPhonenumber, oldPhoneNumber),
          ),
        );

      if (result.affectedRows > 0) {
        response.code = 200;
        response.message = "Phone Number updated successfully.";
      } else {
        response.code = 400;
        response.message = "Error updating phone number.";
      }
    } else {
      response.code = 400;
      response.message = "Invalid request.";
    }
  } catch (err) {
    tools.serverLog(
      `Error in pushNewPhoneNumber: ${err}`,
      "pushNewPhoneNumber-0",
    );
    // Drizzle wraps the real driver error in a DrizzleQueryError -- the
    // original mysql2 error (with .code) is at .cause, not the top level.
    // @ts-ignore
    const errCode = err?.cause?.code ?? err?.code;
    response.code = 500;
    if (
      errCode === "ECONNREFUSED" ||
      errCode === "PROTOCOL_CONNECTION_LOST" ||
      errCode === "ETIMEDOUT"
    ) {
      response.message =
        "Could not reach the server. Please try again shortly.";
    } else if (requestNewCode) {
      response.message = "Could not send verification code. Please try again.";
    } else {
      response.message =
        "Could not update your phone number. Please try again.";
    }
  }
  return response;
}
