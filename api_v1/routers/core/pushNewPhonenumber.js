import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";
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
            const [rows] = await db_pool.query("SELECT user_id FROM users WHERE user_phonenumber = ? LIMIT 1", [newPhoneNumber]);

            if (Array.isArray(rows) && rows.length > 0) {
                response.code = 400;
                response.message = "Phone Number already exists.";
            }
            else {
                const randVCode = Math.floor(Math.random() * 900000) + 100000;
                /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
                const [result] = await db_pool.query("UPDATE users SET user_auth_verificationcode = ? WHERE user_id = ? AND user_phonenumber = ?", [randVCode, sessions.currentUserID, oldPhoneNumber]);

                if (result.affectedRows > 0) {
                    response.code = 200;
                    response.message = "Verification code sent to your new number.";
                }
                else {
                    response.code = 400;
                    response.message = "Error sending verification code.";
                }
            }
        }
        else if (tools.validateIsNumber(verificationCode)) {
            /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
            const [result] = await db_pool.query("UPDATE users SET user_phonenumber = ?, user_auth_verificationcode = NULL WHERE user_id = ? AND user_phonenumber = ? AND user_auth_verificationcode = ?", [newPhoneNumber, sessions.currentUserID, oldPhoneNumber, verificationCode]);

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
