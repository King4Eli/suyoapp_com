import express from 'express';
import crypto from 'crypto';
import ngeohash from 'ngeohash';
import db_pool from '../../global/database.js';
import { namer, sessions, tools } from '../../global/functions.js';
import pushLocation from '../core/pushLocation.js';
import {redisDo} from '../../global/redisClient.js';
import {communicateWith} from '../../global/sendingCommunicate.js';

const signup_router = express.Router();

const cleanPhone = (/** @type {any} */ value) => String(value ?? '').replace(/\D/g, '').trim();
const cleanText = (/** @type {any} */ value, max = 250) => String(value ?? '').trim().slice(0, max);
const onlyNumberOrDefault = (/** @type {any} */ value, /** @type {number} */ fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};
const birthdayToDb = (/** @type {any} */ value) => cleanText(value).replace(/\D/g, '').slice(0, 8);
const locationToDb = (/** @type {any} */ value) => {
    const location = value && typeof value === 'object' ? value : {};
    const latd = Number(location.latd ?? location.lat ?? location.latitude);
    const long = Number(location.long ?? location.lng ?? location.longitude);
    const hasCoordinates = Number.isFinite(latd) && Number.isFinite(long);
    const safeLatd = hasCoordinates ? latd : 0;
    const safeLong = hasCoordinates ? long : 0;

    return {
        meta: JSON.stringify({
            ...location,
            latd: safeLatd,
            long: safeLong,
        }),
        hash: ngeohash.encode(safeLatd, safeLong, 12),
        long: safeLong,
        latd: safeLatd,
    };
};

signup_router.post('/', async (req, res) => {
    const phonenumber = cleanPhone(req.body.user_phone);
    const callingCode = String(req.body.cc ?? '1').trim();
    const verificationCode = cleanPhone(req.body.vcode);

    if (!process.env.SESSION_ENCRYPT_HASH) {
        return res.json({ code: 500, message: 'Error creating session#' });
    }

    if (phonenumber.length < 10) {
        return res.json({ code: 400, message: 'Invalid phone number.' });
    }

    if (!verificationCode || verificationCode.length < 6) {
        const [existingRows] = await db_pool.execute('SELECT user_id FROM users WHERE user_phonenumber = ?', [phonenumber]);
        // @ts-ignore
        if (existingRows?.length > 0) {
            return res.json({ code: 409, message: 'Account already exists. Please log in.' });
        }

        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        await communicateWith.sendSms(callingCode, phonenumber, `Your verification code is ${pin}.`);
        await redisDo(async (client) => {
            const ttlSeconds = 10 * 60; // 10 minutes
            await client.set(`signup:${phonenumber}`, String(pin), { EX: ttlSeconds });
        });
        
        return res.json({
            code: 200,
            message: 'Your signup code has been sent.',
        });
    }
    
    const verificationCode_key = `${namer.redis.verifyCode}${phonenumber}`;
    const codeIsValid = await redisDo(async (client) => {
        const stored = await client.get(verificationCode_key);
        if (!stored || !verificationCode || stored !== String(verificationCode)) {
            return false;
        }
        await client.del(verificationCode_key);
        return true;
    }); 
     if (!codeIsValid) {
        return res.json({ code: 404, message: 'Wrong or expired code.' });
    }

    const genUserId = tools.generateAlphanumeric(9, 50, false);
    const firstName = cleanText(req.body.first_name, 80);
    const birthday = birthdayToDb(req.body.birthday);
    const gender = onlyNumberOrDefault(req.body.gender, 0);
    const interestedIn = onlyNumberOrDefault(req.body.interested_in, -99);
    const intent = onlyNumberOrDefault(req.body.intent, -99);
    const bio = cleanText(req.body.bio, 400);
    const email = `${phonenumber}@example.com`;
    const photos = Array.isArray(req.body.photos) ? req.body.photos.slice(0, 6) : [];
    const location = locationToDb(req.body.location);
    const settings = JSON.stringify({ signup_complete: true });

    if (!firstName || birthday.length !== 8) {
        return res.json({ code: 400, message: 'Missing required profile details.' });
    }

    const connection = await db_pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.execute(
            `INSERT INTO users (
                user_id, user_email, user_phonenumber, user_phonenumber_meta, user_fullname,
                user_image, user_active, geo_meta, geo_hash, geo_long, geo_latd,
                user_verified, user_signedup_device_stats,
                user_bio_relationshipgoal, user_bio_gender,
                user_bio_about, user_bio_dob, user_preference_gender, user_settings,
                user_bio_smoking, user_bio_drinking, user_bio_children, user_bio_haspet
            ) VALUES (?, ?, ?, ?, ?, ?, '1', ?, ?, ?, ?, '1', ?, ?, ?, ?, ?, ?, ?, '0', '0', '0', '0')`,
            [
                genUserId,
                email,
                phonenumber,
                JSON.stringify({ verified_at: new Date().toISOString() }),
                firstName,
                JSON.stringify(photos.map((/** @type {any} */ uri, /** @type {any} */ index) => ({ p: uri, o: index }))),
                location.meta,
                location.hash,
                location.long,
                location.latd,
                JSON.stringify(req.body.device_stats ?? {}),
                intent,
                gender,
                bio,
                birthday,
                interestedIn,
                settings,
            ],
        );

        // const interests = Array.isArray(req.body.interests) ? req.body.interests : [];
        // for (const interest of interests) {
        //     const interestId = Number(interest);
        //     if (Number.isInteger(interestId) && interestId > 0) {
        //         await connection.execute(
        //             'INSERT INTO users_interests (user_id, interests_variant_ref_id) VALUES (?, ?)',
        //             [userId, interestId],
        //         );
        //     }
        // }

        await connection.commit();
    }
    catch (err) {
        await connection.rollback();
        // @ts-ignore
        if (err?.code === 'ER_DUP_ENTRY') {
            return res.json({ code: 409, message: 'Account already exists. Please log in.' });
        }
        // @ts-ignore
        tools.serverLog("Error creating user: " + err.message, "signup_error_100");
        return res.json({ code: 400, message: 'Account not created.' });
    }
    finally {
        connection.release();
    }

    if (req.body.location) {
        // @ts-ignore
        pushLocation(JSON.stringify(req.body.location), userId).catch(err => tools.serverLog("Error pushing location: " + err.message, "signup_error_101"));
    }

    const sessionToken = sessions.createSession(genUserId);
    const sessionHash = crypto.createHash('sha256').update(process.env.SESSION_ENCRYPT_HASH + sessionToken + process.env.SESSION_ENCRYPT_HASH).digest('hex');

    res.set('x-omi-auth', sessionToken);
    res.set('x-omi-hash', sessionHash);
    return res.json({
        code: 200,
        message: 'Signup complete.',
        user_id: genUserId,
    });
});

export default signup_router;
