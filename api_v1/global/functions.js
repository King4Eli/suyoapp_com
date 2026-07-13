import crypto from 'crypto';
import Stripe from 'stripe';
import db_pool from "../global/database.js";

export class tools {
    static algorithm = 'aes-256-cbc';
    static key = crypto.scryptSync('your-strong-secret', 'salt', 32); // 32 bytes key
    static iv = crypto.randomBytes(16); // initialization vector
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
    //@ts-ignore
    static encodeStr(plainText) {
        const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
        let encrypted = cipher.update(plainText, 'utf-8', 'base64');
        encrypted += cipher.final('base64');
        // Prepend IV for decryption
        return this.iv.toString('base64') + ':' + encrypted;
    }
    //@ts-ignore
    static decodeStr(encodedText) {
        try {
            const [ivStr, encrypted] = encodedText.split(':');
            if (!ivStr || !encrypted)
                return false;
            const iv = Buffer.from(ivStr, 'base64');
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            let decrypted = decipher.update(encrypted, 'base64', 'utf-8');
            decrypted += decipher.final('utf-8');
            return decrypted;
        }
        catch {
            return false;
        }
    }

    static validateIsNumber(value = '') {

        return /^\d+$/.test(value);
    }

    static validateIsEmail(email = '') {
        if (!email || email === '')
            return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
export class sessions {
    static temp_current_session_ID = null;
    // Static setter
    static set currentUserID(val) {
        this.temp_current_session_ID = val;
    }
    // Static getter
    static get currentUserID() {
        return this.temp_current_session_ID;
    }
    // Create session
    //@ts-ignore
    static createSession(userId) {
        const ses = {
            rand0: Math.floor(Math.random() * 1e6),
            user_id: userId,
            timeout: Math.floor(Date.now() / 1000) + 923567, // ~10 days
            rand: Math.floor(Math.random() * 1e6)
        };
        return tools.encodeStr(JSON.stringify(ses));
    }
    // Verify session
    //@ts-ignore
    static verifySessionHash(stringV) {
        if (!stringV)
            return false;
        const decoded = tools.decodeStr(stringV);
        if (!decoded)
            return false;
        const ses = JSON.parse(decoded);
        if (ses.timeout && Math.floor(Date.now() / 1000) < ses.timeout) {
            this.currentUserID = ses.user_id;
            return true;
        }
        else {
            this.currentUserID = null;
        }
        return false;
    }

    static verifyFullSession(auth_token="", auth_hash="") {
        if (!auth_token || !auth_hash) {
            return { status: false, code: 400, message: "Authentication token and hash are required." };
        }
        
        if (!process.env.SESSION_ENCRYPT_HASH) {
            return {status:false, code: 500, message: "Unable to verify session#" };
        }

        const session_hash = crypto.createHash('sha256').update(process.env.SESSION_ENCRYPT_HASH + auth_token + process.env.SESSION_ENCRYPT_HASH).digest('hex');
        const sessionHash_validate = sessions.verifySessionHash(auth_token);

        if (!sessionHash_validate || (auth_hash !== session_hash)) {
            return { status: false, code: 401, message: "Unauthorized" };
        }
        return { status: true, code: 200, message: "Authorized" };
    }
}

export const namer = {
    redis: {
        verifyCode: "verify:code:",
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
    }
}

export const stripe_gateway = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

