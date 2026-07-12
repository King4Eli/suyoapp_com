import { tools } from "./functions";
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// @ts-ignore
export default async function sendSms_v1(countryCode, phoneNumber, message) {
    if (!countryCode || !phoneNumber || !message) {
        tools.serverLog("Missing parameters for sendSms", "sms_error_3g6");
        return {code: 400, message: "Missing parameters for sendSms"};
    }
    if(!parsePhoneNumberFromString(phoneNumber, countryCode)) {
        tools.serverLog("Invalid phone number", "sms_error_3g4");
        return {code: 400, message: "Invalid phone number"};
    }

    const url = "https://sms.vintolab.com/api/core/v1/pushaddNewMessage";

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + Buffer.from(`${process.env.SMSGLOBAL_USERNAME}:${process.env.SMSGLOBAL_PASSWORD}`).toString("base64")
            },
            body: new URLSearchParams({
                countryphonecode: countryCode,
                phonenumber: phoneNumber,
                message: message,

                country: countryCode,
                shortcountry: countryCode
            }).toString()
        });

        const data = await response.text();

        if (!response.ok) {
            tools.serverLog(`SMS gateway returned ${response.status}: ${data}`, "sms_error_3g5");
            return { code: 502, message: "Failed to send SMS" };
        }

        return { code: 200, message: "SMS queued successfully", data };
    } catch (error) {
        // @ts-ignore
        tools.serverLog("Error sending SMS: " + error.message, "sms_error_3g3");
        return { code: 500, message: "Error sending SMS" };
    }
}
