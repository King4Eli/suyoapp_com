import Stripe from 'stripe';
import db_pool from "../global/database.js";
import { sessions } from './sessions.js';

/**
 * Reads a positive integer from process.env, falling back to a default when unset,
 * empty, or not a valid positive number -- lets every rate-limit/timeout constant be
 * overridden via .env without each call site duplicating its own parsing/guard logic.
 * @param {string} name
 * @param {number} fallback
 */
export function envInt(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

export class tools {
    //@ts-ignore
    static generateAlphanumeric(minLength, maxLength, upperCase = false) {
        const chars = (upperCase ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : '') + "abcdefghijklmnopqrstuvwxyz0123456789";
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    static randomInt(min=1, max=1000) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static validateIsNumber(value = '') {

        return /^\d+$/.test(value);
    }

    static validateIsEmail(email = '') {
        if (!email || email === '')
            return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    static maskEmail(email = '') {
        if (!tools.validateIsEmail(email)) return email;
        const [local, domain] = email.split('@');
        const maskedLocal = local.length <= 2
            ? local.charAt(0) + '*'.repeat(Math.max(local.length - 1, 1))
            : local.slice(0, 2) + '*'.repeat(Math.max(local.length - 3, 1)) + local.slice(-1);
        const domainParts = domain.split('.');
        const tld = domainParts.pop();
        return `${maskedLocal}@***.${tld}`;
    }

    static maskPhone(countryCode = '', phoneNumber = '') {
        const digits = String(phoneNumber).replace(/\D/g, '');
        const lastTwo = digits.slice(-2);
        const maskedLength = Math.min(Math.max(digits.length - 2, 3), 6);
        return `+${countryCode} ${'*'.repeat(maskedLength)}${lastTwo}`;
    }

    static serverLog(message="", title="log_") {
        // Implementation for server logging
        (async ()=>{
            try{
                const id= "lg_" + this.generateAlphanumeric(10, 46);
                // @ts-ignore
                const [jj]=await db_pool.query(
                    `INSERT INTO logs_application
                    (report_id, report_type,report_data,report_currentuser)
                    VALUES (?,?,?,?)`,
                    [id, "server_"+title, message, (sessions.currentUserID || null)]
                );
                // @ts-ignore
                if (!jj || jj?.affectedRows === 0) {
                    console.error(">> 🔴 🔴 Failed to log message to database: No rows affected");
                }else{
                    console.log("\n--",`[${new Date().toISOString()}]`,">> logged server Error ID:", id);
                }
            }catch(e){
                console.error(">> 🔴 🔴 Failed to log message to database:", e,"\n--->>>",message);
            }
        })();
 
    }
}

export const namer = {
    redis: {
        verifyCode: "verify:code:",
        products: "products:list",
    },
    ratelimit: {
        login_ip: "ratelimit:login:ip:",
        login_otp_request: "ratelimit:login:otp-request:",
        login_otp_verify: "ratelimit:login:otp-verify:",
        signup_ip: "ratelimit:signup:ip:",
        signup_otp_request: "ratelimit:signup:otp-request:",
        signup_otp_verify: "ratelimit:signup:otp-verify:",
        phonechange_otp_request: "ratelimit:phonechange:otp-request:",
        phonechange_otp_verify: "ratelimit:phonechange:otp-verify:",
        emailchange_otp_request: "ratelimit:emailchange:otp-request:",
        emailchange_otp_verify: "ratelimit:emailchange:otp-verify:",
        likes_daily: "ratelimit:likes:daily:",
    }
}

export const stripe_gateway = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

