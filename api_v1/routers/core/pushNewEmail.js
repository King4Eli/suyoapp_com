import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";
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
                const randVCode = Math.floor(Math.random() * 900000) + 100000;
                /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
                const [result] = await db_pool.query("UPDATE users SET user_auth_verificationcode = ? WHERE user_id = ? AND user_email = ?", [randVCode, sessions.currentUserID, oldEmail]);

                if (result.affectedRows > 0) {
                    response.code = 200;
                    response.message = "Verification code sent to your new email.";
                }
                else {
                    response.code = 400;
                    response.message = "Error sending verification code.";
                }
            }
        }
        else if (tools.validateIsNumber(verificationCode)) {
            /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
            const [result] = await db_pool.query("UPDATE users SET user_email = ?, user_auth_verificationcode = NULL WHERE user_id = ? AND user_email = ? AND user_auth_verificationcode = ?", [newEmail, sessions.currentUserID, oldEmail, verificationCode]);

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
