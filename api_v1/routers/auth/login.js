import express from 'express';
import crypto from 'crypto';
import { sessions, tools } from '../../global/functions.js';
import db_pool from '../../global/database.js';
const login_router = express.Router();
login_router.post('/', async (req, res) => {
    const phonenumber = String(req.body.user_phone ?? '').trim();
    const vpincode = String(req.body.vcode ?? '').trim();

    if (!process.env.SESSION_ENCRYPT_HASH) {
        return res.json({
            code: 500,
            message: 'Error creating session#', 
        });
    }

    // STEP 1: Request verification code
    if (!vpincode || vpincode.length < 6) {
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
        const pin = Math.floor(100000 + Math.random() * 900000);
        // send email if real email
        if (!user.user_email.endsWith('@example.com')) {
            await tools.sendVerificationEmail(user.user_email, pin.toString());
        }
        const [update] = await db_pool.execute('UPDATE users SET user_auth_verificationcode = ? WHERE user_phonenumber = ?', [pin, phonenumber]);
        // @ts-ignore
        if (update.affectedRows > 0) {
            return res.json({
                code: 200,
                message: 'Your code has been sent to your email.'
            });
        }
        return res.json({
            code: 400,
            message: 'Failed to send verification code.'
        });
    }
    // STEP 2: Verify submitted code
    const [rows] = await db_pool.execute('SELECT user_id FROM users WHERE user_phonenumber = ? AND user_auth_verificationcode = ?', [phonenumber, vpincode]);
    // @ts-ignore
    if (rows.length !== 1) {
        return res.json({ code: 404, message: 'Wrong code.' });
    }
    // @ts-ignore
    const userId = rows[0].user_id;
    const sessionToken = sessions.createSession(userId);
    const sessionHash = crypto.createHash('sha256').update(process.env.SESSION_ENCRYPT_HASH + sessionToken + process.env.SESSION_ENCRYPT_HASH).digest('hex');
    await db_pool.execute('UPDATE users SET user_auth_verificationcode = NULL WHERE user_phonenumber = ? AND user_auth_verificationcode = ?', [phonenumber, vpincode]);
    res.set('x-omi-auth', sessionToken);
    res.set('x-omi-hash', sessionHash);
    return res.json({
        code: 200,
        message: 'ok'
    });
});
export default login_router;
