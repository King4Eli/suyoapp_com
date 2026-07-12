import { tools } from "./functions.js";
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import nodemailer from 'nodemailer';

export class communicateWith {
    // @ts-ignore
   static sendSms = async (countryCode, phoneNumber, message)  => {
        if (!countryCode || !phoneNumber || !message) {
            tools.serverLog("Missing parameters for sendSms", "sms_error_3g6");
            return {code: 400, message: "Missing parameters for sendSms"};
        }
        // remove on prod
        // **
        // remove on prod
        // **
        // remove on prod
        // **
        // remove on prod
        // **
        // remove on prod
        // **
        // remove on prod
        // **
        // remove on prod
        // **
        // remove on prod
        // **
        const numberIsTesting=/^0*[1-9]/.test(phoneNumber);
        // countryCode here is a numeric calling code (e.g. "1"), not an ISO country
        // like "US" that parsePhoneNumberFromString's 2nd arg expects. Build a full
        // E.164-ish string instead so validation doesn't need an ISO country at all.
        const fullNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${countryCode}${phoneNumber}`;
        const parsedNumber = parsePhoneNumberFromString(fullNumber);
        if (!parsedNumber?.isValid()) {
            tools.serverLog("Invalid phone number", "sms_error_3g4");
            return {code: 400, message: "Invalid phone number"};
        }

        const url = "https://sms.vintolab.com/api/core/v1/pushaddNewMessage";

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": "Basic " + Buffer.from("1234:54322").toString("base64")
                },
                body: new URLSearchParams({
                    countryphonecode: numberIsTesting ? "+1" : countryCode,
                    phonenumber: numberIsTesting ? "8506317422" : phoneNumber,
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
    };

    // @ts-ignore
    static sendEmail = async (fromEmail, toEmail, subject, messageHtml, messageText) =>{
        if (fromEmail !== null && (!tools.validateIsEmail(toEmail) || !tools.validateIsEmail(fromEmail))) {
            return {code: 400, message: "Invalid parameters for sendEmail"};
        }

        try {
            const smtphost = process.env.SMTP_MAIL_DOMAIN;
            const smtpusername = process.env.SMTP_MAIL_USERNAME;
            const smtppassword = process.env.SMTP_MAIL_PASSWORD;
            const smtpport = Number(process.env.SMTP_MAIL_PORT);
            if (!smtphost || !smtpusername || !smtppassword || !Number.isInteger(smtpport) || smtpport <= 0) return false;

            const transporter = nodemailer.createTransport({
                host: smtphost,
                port: smtpport,
                secure: smtpport === 465,
                auth: {
                    user: smtpusername,
                    pass: smtppassword
                }
            });

            const info = await transporter.sendMail({
                from: smtpusername,
                // if email is example.com, don't send email, just log it
                // remove on prod
                // **
                // remove on prod
                // **
                // remove on prod
                // **
                // remove on prod
                // **
                // remove on prod
                // **
                // remove on prod
                // **
                to: toEmail.includes("@example.com")?"toballz@yahoo.com":toEmail,
                subject: subject,
                text: messageText,
                html: messageHtml
            });
            tools.serverLog(`Email sent: ${info.messageId} to ${toEmail}`, "email_sent_301");
            return {code: 200, message: "Email sent successfully", data: { messageId: info?.messageId }};
        }
        catch {
            tools.serverLog("Error sending email", "email_error_300");
            return {code: 500, message: "Error sending email"};
        }
    }
}
