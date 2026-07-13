import db_pool from "../../global/database.js";
import { namer, sessions, tools } from "../../global/functions.js";
import { redisDo } from "../../global/redisClient.js";
import {communicateWith} from "../../global/sendingCommunicate.js";
import { checkRateLimit } from "../../global/rateLimit.js";
/**
 * @param {any} oldPhoneNumber
 * @param {string | undefined} newPhoneNumber
 * @param {any} requestNewCode
 * @param {string | undefined} verificationCode
 */
export default async function pushNewPhoneNumber(oldPhoneNumber, newPhoneNumber, requestNewCode, verificationCode) {
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
            const otpRequestLimit = await checkRateLimit(`ratelimit:phonechange:otp-request:${sessions.currentUserID}`, 5, 600);
            if (!otpRequestLimit.allowed) {
                response.code = 429;
                response.message = "Too many codes requested. Please try again later.";
                return response;
            }

            const [rows] = await db_pool.query("SELECT user_id FROM users WHERE user_phonenumber = ? LIMIT 1", [newPhoneNumber]);

            if (Array.isArray(rows) && rows.length > 0) {
                response.code = 400;
                response.message = "Phone Number already exists.";
            }
            else {
                const genPinCode = Math.floor(Math.random() * 900000) + 100000;
                await communicateWith.sendSms("1", newPhoneNumber, `Your verification code is ${genPinCode}. Do not share this code with anyone. It expires in 5 minutes.`);
                await redisDo(async (client) => {
                    await client.set(`${namer.redis.verifyCode}phone:${sessions.currentUserID}`, genPinCode);
                    await client.expire(`${namer.redis.verifyCode}phone:${sessions.currentUserID}`, 300); // 5 minutes
                });
                response.code = 200;
                response.message = "Verification code sent to your new number.";
            }
        }
        else if (tools.validateIsNumber(verificationCode)) {
            const otpVerifyLimit = await checkRateLimit(`ratelimit:phonechange:otp-verify:${sessions.currentUserID}`, 10, 600);
            if (!otpVerifyLimit.allowed) {
                response.code = 429;
                response.message = "Too many attempts. Please try again later.";
                return response;
            }

            const codeIsValid = await redisDo(async (client) => {
                const code = await client.get(`${namer.redis.verifyCode}phone:${sessions.currentUserID}`);
                const isValid = code === verificationCode;
                if (isValid) {
                    await client.del(`${namer.redis.verifyCode}phone:${sessions.currentUserID}`);
                }
                return isValid;
            });
            if (!codeIsValid) {
                response.code = 400;
                response.message = "Wrong or expired code.";
                return response;
            }

            /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
            const [result] = await db_pool.query("UPDATE users SET user_phonenumber = ? WHERE user_id = ? AND user_phonenumber = ?", [newPhoneNumber, sessions.currentUserID, oldPhoneNumber]);

            if (result.affectedRows > 0) {
                response.code = 200;
                response.message = "Phone Number updated successfully.";
            }
            else {
                response.code = 400;
                response.message = "Error updating phone number.";
            }
        }
        else {
            response.code = 400;
            response.message = "Invalid request.";
        }
    }
    catch (err) {
        tools.serverLog(`Error in pushNewPhoneNumber: ${err}`,'pushNewPhoneNumber-0');
        response.code = 500;
        response.message = "Database error.";
    }
    return response;
}
