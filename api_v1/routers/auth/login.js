import express from 'express';
import crypto from 'crypto';
import { namer, sessions  } from '../../global/functions.js';
import db_pool from '../../global/database.js';
import {communicateWith   }  from '../../global/sendingCommunicate.js';
import {redisDo} from '../../global/redisClient.js';
import { checkRateLimit } from '../../global/rateLimit.js';

const login_router = express.Router();
login_router.post('/', async (req, res) => {
    const phonenumber = String(req.body.user_phone ?? '').trim();
    const countryCode = String(req.body.cc ?? '1').trim();
    const vpincode = String(req.body.vcode ?? '').trim();

    if (!process.env.SESSION_ENCRYPT_HASH) {
        return res.json({
            code: 500,
            message: 'Error creating session#',
        });
    }

    const ipLimit = await checkRateLimit(`${namer.ratelimit.login_ip}${req.ip}`, 30, 600);
    if (!ipLimit.allowed) {
        res.set('Retry-After', String(ipLimit.retryAfterSeconds));
        return res.status(429).json({ code: 429, message: 'Too many requests. Please try again later.' });
    }

    // STEP 1: Request verification code
    if (!vpincode || vpincode.length < 6) {
        const otpRequestLimit = await checkRateLimit(`${namer.ratelimit.login_otp_request}${phonenumber}`, 5, 600);
        if (!otpRequestLimit.allowed) {
            res.set('Retry-After', String(otpRequestLimit.retryAfterSeconds));
            return res.status(429).json({ code: 429, message: 'Too many codes requested. Please try again later.' });
        }

        const [rows] = await db_pool.execute('SELECT user_email, user_active FROM users WHERE user_phonenumber = ?', [phonenumber]);
        // @ts-ignore
        if (rows.length === 0) {
            return res.json({ code: 404, to: "signup", message: 'Account not found.' });
        }
        // @ts-ignore
        const user = rows[0];
        if (!['0', '1', 0, 1].includes(user.user_active)) {
            return res.json({
                code: 404,
                message: 'Login credentials does not exist.',
                logincode: user.user_active
            });
        }
        const genPin = Math.floor(100000 + Math.random() * 999999).toString().slice(0, 6);
        
        const smsMessage=`Your verification code is ${genPin}. Do not share this code with anyone. It expires in 10 minutes.`;
        await communicateWith.sendSms(countryCode, phonenumber, smsMessage);
        await communicateWith.sendEmail(null,user?.user_email, "Your Verification Code",`<p>Your verification code is <strong>${genPin}</strong>. Do not share this code with anyone. It expires in 10 minutes.</p>`,smsMessage);
        
        // set the verification code in Redis with a 10-minute expiration
        const ttlSeconds = 10 * 60; // 10 minutes
        const key = `${namer.redis.verifyCode}${phonenumber}`;
        await redisDo(async (client) => {
            await client.set(key, String(genPin), { EX: ttlSeconds })
        });


        return res.json({
            code: 200,
            message: 'Your code has been sent to your email.'
        });
    }
    // STEP 2: Verify submitted code
    const otpVerifyLimit = await checkRateLimit(`${namer.ratelimit.login_otp_verify}${phonenumber}`, 10, 600);
    if (!otpVerifyLimit.allowed) {
        res.set('Retry-After', String(otpVerifyLimit.retryAfterSeconds));
        return res.status(429).json({ code: 429, message: 'Too many attempts. Please try again later.' });
    }
    const verificationCode_key = `${namer.redis.verifyCode}${phonenumber}`;
    const codeIsValid = await redisDo(async (client) => {
        const stored = await client.get(verificationCode_key);
        if (!stored || !vpincode || stored !== String(vpincode)) {
            return false;
        }
        await client.del(verificationCode_key);
        return true;
    });

    if (!codeIsValid) {
        return res.json({ code: 404, message: 'Wrong code.' });
    }
    const [rows] = await db_pool.execute('SELECT user_id FROM users WHERE user_phonenumber = ?', [phonenumber]);
    // @ts-ignore
    if (rows.length !== 1) {
        return res.json({ code: 404, message: 'Wrong code.' });
    }
    // @ts-ignore
    const userId = rows[0].user_id;
    const sessionToken = sessions.createSession(userId);
    const sessionHash = crypto.createHash('sha256').update(process.env.SESSION_ENCRYPT_HASH + sessionToken + process.env.SESSION_ENCRYPT_HASH).digest('hex');
    res.set('x-omi-auth', sessionToken);
    res.set('x-omi-hash', sessionHash);
    return res.json({
        code: 200,
        message: 'ok'
    });
});
export default login_router;
