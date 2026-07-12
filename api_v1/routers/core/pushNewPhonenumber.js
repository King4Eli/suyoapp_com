import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";
import { setVerificationCode, verifyAndConsumeCode } from "../../global/verificationCode.js";
import sendSms_v1 from "../../global/sendingCommunicate.js";
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
                await sendSms_v1("1", newPhoneNumber, `Your verification code is ${randVCode}.`);
                await setVerificationCode(`phonechange:${sessions.currentUserID}`, randVCode);
                response.code = 200;
                response.message = "Verification code sent to your new number.";
            }
        }
        else if (tools.validateIsNumber(verificationCode)) {
            const codeIsValid = await verifyAndConsumeCode(`phonechange:${sessions.currentUserID}`, verificationCode);
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
