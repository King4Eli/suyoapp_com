import { tools } from "./functions.js";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import nodemailer from "nodemailer";

export class communicateWith {
  // @ts-ignore
  static sendSms = async (callingCountryCode, phoneNumber, message) => {
    if (!callingCountryCode || !phoneNumber || !message) {
      tools.serverLog("Missing parameters for sendSms", "sms_error_3g6");
      return { code: 400, message: "Missing parameters for sendSms" };
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
    const numberIsTesting = /^0+/.test(phoneNumber);

    const fullNumber = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+${callingCountryCode}${phoneNumber}`;
    const parsedNumber = parsePhoneNumberFromString(fullNumber);
    // remove numberIsTesting on prod
    // // remove on prod
    // // remove on prod
    //

    if (!numberIsTesting && !parsedNumber?.isValid()) {
      tools.serverLog("Invalid phone number", "sms_error_3gy");
      return { code: 400, message: "Invalid phone number" };
    }

    const url = "https://sms.vintolab.com/api/core/v1/pushaddNewMessage";
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryphonecode: numberIsTesting ? "+1" : callingCountryCode,
          phonenumber: numberIsTesting ? "8506317422" : phoneNumber,
          message: message,

          country: callingCountryCode,
          shortcountry: parsedNumber?.country,
        }),
      });

      const data = await response.text();

      if (!response.ok) {
        tools.serverLog(
          `SMS gateway returned ${response.status}: ${data}`,
          "sms_error_3g5",
        );
        return { code: 502, message: "Failed to send SMS" };
      }

      return { code: 200, message: "SMS queued successfully", data };
    } catch (error) {
      // @ts-ignore
      tools.serverLog(error.message, "sms_error_3g3");
      return { code: 500, message: "Error sending SMS" };
    }
  };

  // @ts-ignore
  static sendEmail = async (
    fromEmail,
    toEmail,
    subject,
    messageHtml,
    messageText,
  ) => {
    if (
      fromEmail !== null &&
      (!tools.validateIsEmail(toEmail) || !tools.validateIsEmail(fromEmail))
    ) {
      return { code: 400, message: "Invalid parameters for sendEmail" };
    }

    try {
      const smtphost = process.env.SMTP_MAIL_DOMAIN;
      const smtpusername = process.env.SMTP_MAIL_USERNAME;
      const smtppassword = process.env.SMTP_MAIL_PASSWORD;
      const smtpport = Number(process.env.SMTP_MAIL_PORT);
      if (
        !smtphost ||
        !smtpusername ||
        !smtppassword ||
        !Number.isInteger(smtpport) ||
        smtpport <= 0
      )
        return false;

      const transporter = nodemailer.createTransport({
        host: smtphost,
        port: smtpport,
        secure: smtpport === 465,
        auth: {
          user: smtpusername,
          pass: smtppassword,
        },
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
        to: toEmail.includes("@example.com") ? "toballz@yahoo.com" : toEmail,
        subject: subject,
        text: messageText,
        html: messageHtml,
      });

      return {
        code: 200,
        message: "Email sent successfully",
        data: { messageId: info?.messageId },
      };
    } catch (e) {
      // @ts-ignore
      tools.serverLog(e?.message, "email_error_300");
      return { code: 500, message: "Error sending email" };
    }
  };
}
