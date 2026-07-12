import db_pool from "../../global/database.js";
import { namer, sessions, tools } from "../../global/functions.js";
import { redisDo } from "../../global/redisClient.js";
import {communicateWith} from "../../global/sendingCommunicate.js";
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
            const [rows] = await db_pool.query("SELECT user_id FROM users WHERE user_email = ? LIMIT 1", [newEmail]);

            if (Array.isArray(rows) && rows.length > 0) {
                response.code = 400;
                response.message = "Email already exists.";
            }
            else {
                const genPinCode = Math.floor(Math.random() * 900000) + 100000;
                await communicateWith.sendEmail("1", newEmail, `<p>Your verification code is <strong>${genPinCode}</strong>. Do not share this code with anyone. It expires in 5 minutes.</p>`);
                await redisDo(async (client) => {
                    await client.set(`${namer.redis.verifyCode}${sessions.currentUserID}`, genPinCode);
                    await client.expire(`${namer.redis.verifyCode}${sessions.currentUserID}`, 300); // 5 minutes
                });

                response.code = 200;
                response.message = "Verification code sent to your new email.";
            }
        }
        else if (tools.validateIsNumber(verificationCode)) {
            const codeIsValid = await redisDo(async (client) => {
                const code = await client.get(`${namer.redis.verifyCode}${sessions.currentUserID}`);
                const isValid = code === verificationCode;
                if (isValid) {
                    await client.del(`${namer.redis.verifyCode}${sessions.currentUserID}`);
                }
                return isValid;
            });            if (!codeIsValid) {
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
        response.code = 500;
        response.message = "Database error.";
    }
    return response;
}
