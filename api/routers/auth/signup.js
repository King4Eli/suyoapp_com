import express from "express";
import ngeohash from "ngeohash";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { namer, tools, envInt } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import pushLocation from "../core/pushLocation.js";
import { redisDo } from "../../global/redisClient.js";
import { communicateWith } from "../../global/sendingCommunicate.js";
import { checkRateLimit } from "../../global/rateLimit.js";

const signup_router = express.Router();

const cleanPhone = (/** @type {any} */ value) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .trim();
const cleanText = (/** @type {any} */ value, max = 250) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const onlyNumberOrDefault = (
  /** @type {any} */ value,
  /** @type {number} */ fallback,
) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const birthdayToDb = (/** @type {any} */ value) =>
  cleanText(value).replace(/\D/g, "").slice(0, 8);
const locationToDb = (/** @type {any} */ value) => {
  const location = value && typeof value === "object" ? value : {};
  const latd = Number(location.latd ?? location.lat ?? location.latitude);
  const long = Number(location.long ?? location.lng ?? location.longitude);
  const hasCoordinates = Number.isFinite(latd) && Number.isFinite(long);
  const safeLatd = hasCoordinates ? latd : 0;
  const safeLong = hasCoordinates ? long : 0;

  return {
    // geo_meta is a native JSON column -- Drizzle's json() stringifies on
    // write, so this stays the raw object, not a pre-stringified string.
    meta: {
      ...location,
      latd: safeLatd,
      long: safeLong,
    },
    hash: ngeohash.encode(safeLatd, safeLong, 12),
    long: safeLong,
    latd: safeLatd,
  };
};

signup_router.post("/", async (req, res) => {
  const phonenumber = cleanPhone(req.body.user_phone);
  const callingCode = String(req.body.cc ?? "1").trim();
  const verificationCode = cleanPhone(req.body.vcode);

  if (!process.env.SESSION_ENCRYPT_HASH) {
    return res.json({ code: 500, message: "Error creating session#" });
  }

  if (phonenumber.length < 10) {
    return res.json({ code: 400, message: "Invalid phone number." });
  }

  const ipLimit = await checkRateLimit(
    `${namer.ratelimit.signup_ip}${req.ip}`,
    envInt("SIGNUP_IP_LIMIT", 30),
    envInt("SIGNUP_IP_WINDOW_SECONDS", 600),
  );
  if (!ipLimit.allowed) {
    res.set("Retry-After", String(ipLimit.retryAfterSeconds));
    return res.status(429).json({
      code: 429,
      message: "Too many requests. Please try again later.",
    });
  }

  if (!verificationCode || verificationCode.length < 6) {
    const otpRequestLimit = await checkRateLimit(
      `${namer.ratelimit.signup_otp_request}${phonenumber}`,
      envInt("SIGNUP_OTP_REQUEST_LIMIT", 5),
      envInt("SIGNUP_OTP_REQUEST_WINDOW_SECONDS", 600),
    );
    if (!otpRequestLimit.allowed) {
      res.set("Retry-After", String(otpRequestLimit.retryAfterSeconds));
      return res.status(429).json({
        code: 429,
        message: "Too many codes requested. Please try again later.",
      });
    }

    const existingRows = await db
      .select({ user_id: users.userId })
      .from(users)
      .where(eq(users.userPhonenumber, phonenumber));
    if (existingRows?.length > 0) {
      return res.json({
        code: 409,
        message: "Account already exists. Please log in.",
      });
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    await communicateWith.sendSms(
      callingCode,
      phonenumber,
      `Your verification code is ${pin}.`,
    );
    await redisDo(async (client) => {
      const ttlSeconds = envInt("SIGNUP_OTP_CODE_TTL_SECONDS", 600);
      await client.set(`${namer.redis.verifyCode}${phonenumber}`, String(pin), {
        EX: ttlSeconds,
      });
    });

    return res.json({
      code: 200,
      message: "Your signup code has been sent.",
    });
  }

  const otpVerifyLimit = await checkRateLimit(
    `${namer.ratelimit.signup_otp_verify}${phonenumber}`,
    envInt("SIGNUP_OTP_VERIFY_LIMIT", 10),
    envInt("SIGNUP_OTP_VERIFY_WINDOW_SECONDS", 600),
  );
  if (!otpVerifyLimit.allowed) {
    res.set("Retry-After", String(otpVerifyLimit.retryAfterSeconds));
    return res.status(429).json({
      code: 429,
      message: "Too many attempts. Please try again later.",
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
    return res.json({ code: 404, message: "Wrong or expired code." });
  }

  const genUserId = tools.generateAlphanumeric(9, 50, false);
  const firstName = cleanText(req.body.first_name, 80);
  const birthday = birthdayToDb(req.body.birthday);
  const gender = onlyNumberOrDefault(req.body.gender, 0);
  const interestedIn = onlyNumberOrDefault(req.body.interested_in, -99);
  const intent = onlyNumberOrDefault(req.body.intent, -99);
  const bio = cleanText(req.body.bio, 400);
  const smoking = String(onlyNumberOrDefault(req.body.smoking, 0));
  const drinking = String(onlyNumberOrDefault(req.body.drinking, 0));
  const children = String(onlyNumberOrDefault(req.body.children, 0));
  const hasPet = String(onlyNumberOrDefault(req.body.haspet, 0));
  const email = `${phonenumber}@example.com`;
  const photos = Array.isArray(req.body.photos)
    ? req.body.photos.slice(0, 6)
    : [];
  const location = locationToDb(req.body.location);
  const settings = JSON.stringify({ signup_complete: true });

  if (!firstName || birthday.length !== 8) {
    return res.json({
      code: 400,
      message: "Missing required profile details.",
    });
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        userId: genUserId,
        userEmail: email,
        userPhonenumber: phonenumber,
        // user_phonenumber_meta is a native JSON column -- pass the object,
        // not a pre-stringified string (Drizzle's json() stringifies on write).
        userPhonenumberMeta: { verified_at: new Date().toISOString() },
        userFullname: firstName,
        userImage: JSON.stringify(
          photos.map((/** @type {any} */ uri, /** @type {any} */ index) => ({
            p: uri,
            o: index,
          })),
        ),
        userActive: "1",
        geoMeta: location.meta,
        geoHash: location.hash,
        geoLong: location.long,
        geoLatd: location.latd,
        userVerified: "1",
        userSignedupDeviceStats: JSON.stringify(req.body.device_stats ?? {}),
        userBioRelationshipgoal: intent,
        userBioGender: gender,
        userBioAbout: bio,
        userBioDob: birthday,
        userPreferenceGender: interestedIn,
        userSettings: settings,
        userBioSmoking: smoking,
        userBioDrinking: drinking,
        userBioChildren: children,
        userBioHaspet: hasPet,
      });

      // const interests = Array.isArray(req.body.interests) ? req.body.interests : [];
      // for (const interest of interests) {
      //     const interestId = Number(interest);
      //     if (Number.isInteger(interestId) && interestId > 0) {
      //         await tx.insert(usersInterests).values({ userId: genUserId, interestsVariantRefId: interestId });
      //     }
      // }
    });
  } catch (err) {
    // Drizzle wraps the real driver error in a DrizzleQueryError -- the
    // original mysql2 error (with .code) is at .cause, not the top level.
    const errCode = err?.cause?.code ?? err?.code;
    tools.serverLog("Error creating user: " + err.message, "signup_error_100");
    if (errCode === "ER_DUP_ENTRY") {
      return res.json({
        code: 409,
        message: "Account already exists. Please log in.",
      });
    }
    if (errCode === "ER_LOCK_DEADLOCK" || errCode === "ER_LOCK_WAIT_TIMEOUT") {
      return res.json({
        code: 409,
        message: "Signup is busy right now. Please try again.",
      });
    }
    if (
      errCode === "ER_DATA_TOO_LONG" ||
      errCode === "ER_BAD_NULL_ERROR" ||
      errCode === "ER_TRUNCATED_WRONG_VALUE"
    ) {
      return res.json({
        code: 400,
        message: "Some profile details are invalid or too long.",
      });
    }
    if (
      errCode === "ECONNREFUSED" ||
      errCode === "PROTOCOL_CONNECTION_LOST" ||
      errCode === "ETIMEDOUT"
    ) {
      return res.json({
        code: 503,
        message: "Could not reach the server. Please try again shortly.",
      });
    }
    return res.json({
      code: 400,
      message: "Account not created due to a server error. Please try again.",
    });
  }

  if (req.body.location) {
    // @ts-ignore
    pushLocation(JSON.stringify(req.body.location), genUserId).catch((err) =>
      tools.serverLog(
        "Error pushing location: " + err.message,
        "signup_error_101",
      ),
    );
  }

  const sessionToken = sessions.createSession(genUserId);

  res.set("x-omi-auth", sessionToken);
  return res.json({
    code: 200,
    message: "Signup complete.",
    user_id: genUserId,
  });
});

export default signup_router;
