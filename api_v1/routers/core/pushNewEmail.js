import db_pool from "../../global/database.js";
import { namer, tools, envInt } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { redisDo } from "../../global/redisClient.js";
import {communicateWith} from "../../global/sendingCommunicate.js";
import { checkRateLimit } from "../../global/rateLimit.js";
/**
 * @param {any} oldEmail
 * @param {string | undefined} newEmail
 * @param {any} requestNewCode
 * @param {string | undefined} verificationCode
 */
export default async function pushNewEmail(oldEmail, newEmail, requestNewCode, verificationCode) {
    const response = {
        code: 400,
        message: "Invalid request.",
    };
    oldEmail = (oldEmail ?? "").trim().toLowerCase();
    newEmail = (newEmail ?? "").trim().toLowerCase();
    verificationCode = (verificationCode ?? "").trim().toLowerCase();
    if (!tools.validateIsEmail(newEmail)) {
        response.code = 400;
        response.message = "Invalid email address.";
        return response;
    }
    try {
        if (requestNewCode) {
            const otpRequestLimit = await checkRateLimit(`${namer.ratelimit.emailchange_otp_request}${sessions.currentUserID}`, envInt('EMAILCHANGE_OTP_REQUEST_LIMIT', 5), envInt('EMAILCHANGE_OTP_REQUEST_WINDOW_SECONDS', 600));
            if (!otpRequestLimit.allowed) {
                response.code = 429;
                response.message = "Too many codes requested. Please try again later.";
                return response;
            }

            const [rows] = await db_pool.query("SELECT user_id FROM users WHERE user_email = ? LIMIT 1", [newEmail]);

            if (Array.isArray(rows) && rows.length > 0) {
                response.code = 400;
                response.message = "Email already exists.";
            }
            else {
                const genPinCode = Math.floor(Math.random() * 900000) + 100000;
                const ttlSeconds = envInt('EMAILCHANGE_OTP_CODE_TTL_SECONDS', 300);
                const ttlMinutes = Math.round(ttlSeconds / 60);
                await communicateWith.sendEmail("1", newEmail, `<p>Your verification code is <strong>${genPinCode}</strong>. Do not share this code with anyone. It expires in ${ttlMinutes} minutes.</p>`);
                await redisDo(async (client) => {
                    await client.set(`${namer.redis.verifyCode}email:${sessions.currentUserID}`, genPinCode);
                    await client.expire(`${namer.redis.verifyCode}email:${sessions.currentUserID}`, ttlSeconds);
                });

                response.code = 200;
                response.message = "Verification code sent to your new email.";
            }
        }
        else if (tools.validateIsNumber(verificationCode)) {
            const otpVerifyLimit = await checkRateLimit(`${namer.ratelimit.emailchange_otp_verify}${sessions.currentUserID}`, envInt('EMAILCHANGE_OTP_VERIFY_LIMIT', 10), envInt('EMAILCHANGE_OTP_VERIFY_WINDOW_SECONDS', 600));
            if (!otpVerifyLimit.allowed) {
                response.code = 429;
                response.message = "Too many attempts. Please try again later.";
                return response;
            }

            const codeIsValid = await redisDo(async (client) => {
                const code = await client.get(`${namer.redis.verifyCode}email:${sessions.currentUserID}`);
                const isValid = code === verificationCode;
                if (isValid) {
                    await client.del(`${namer.redis.verifyCode}email:${sessions.currentUserID}`);
                }
                return isValid;
            });
            if (!codeIsValid) {
                response.code = 400;
                response.message = "Wrong or expired code.";
                return response;
            }

            /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
            const [result] = await db_pool.query("UPDATE users SET user_email = ? WHERE user_id = ? AND user_email = ?", [newEmail, sessions.currentUserID, oldEmail]);

            if (result.affectedRows > 0) {
                response.code = 200;
                response.message = "Email updated successfully.";
            }
            else {
                response.code = 400;
                response.message = "Error updating email.";
            }
        }
        else {
            response.code = 400;
            response.message = "Invalid request.";
        }
    }
    catch (err) {
        tools.serverLog(`Error in pushNewEmail: ${err}`,'pushNewEmail-0');
        // @ts-ignore
        const errCode = err?.code;
        response.code = 500;
        if (errCode === 'ECONNREFUSED' || errCode === 'PROTOCOL_CONNECTION_LOST' || errCode === 'ETIMEDOUT') {
            response.message = "Could not reach the server. Please try again shortly.";
        } else if (requestNewCode) {
            response.message = "Could not send verification code. Please try again.";
        } else {
            response.message = "Could not update your email. Please try again.";
        }
    }
    return response;
}
