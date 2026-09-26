import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { userVerifications, users } from "../db/schema.js";
import { redisDo } from "./redisClient.js";
import { namer } from "./namer.js";

// Selfie verification: the server picks a pose, the user takes a selfie doing it,
// an admin compares it with their profile photos (admin/pages/verifications.php).
// A fresh random pose each time means an old or downloaded photo won't pass.

/** code -> what the app shows (icon is an Ionicons name) */
export const VERIFICATION_POSES = {
  peace_sign: {
    label: "Hold up a peace sign ✌️ next to your face",
    icon: "hand-left",
  },
  thumbs_up: {
    label: "Give a thumbs up 👍 next to your face",
    icon: "thumbs-up",
  },
  touch_nose: { label: "Touch your nose with one finger", icon: "happy" },
  hand_on_head: { label: "Put one hand on top of your head", icon: "person" },
  three_fingers: {
    label: "Hold up three fingers next to your face",
    icon: "hand-right",
  },
  cover_one_eye: { label: "Cover one eye with your hand", icon: "eye-off" },
};

const POSE_TTL_SECONDS = 30 * 60;

/**
 * @typedef {"verified" | "pending" | "rejected" | "none"} VerificationStatus
 */

/**
 * Where the user stands: verified (users.user_verified), otherwise their latest
 * request's state.
 * @param {string} userId
 * @returns {Promise<{ status: VerificationStatus; rejectReason: string | null; submittedAt: Date | null }>}
 */
export async function getVerificationState(userId) {
  const [user] = await db
    .select({ verified: users.userVerified })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  if (user?.verified === "1") {
    return { status: "verified", rejectReason: null, submittedAt: null };
  }
  const [latest] = await db
    .select({
      status: userVerifications.status,
      rejectReason: userVerifications.rejectReason,
      createdAt: userVerifications.createdAt,
    })
    .from(userVerifications)
    .where(eq(userVerifications.userId, userId))
    .orderBy(desc(userVerifications.createdAt))
    .limit(1);
  if (latest?.status === 0) {
    return {
      status: "pending",
      rejectReason: null,
      submittedAt: latest.createdAt,
    };
  }
  if (latest?.status === 2) {
    return {
      status: "rejected",
      rejectReason: latest.rejectReason ?? null,
      submittedAt: latest.createdAt,
    };
  }
  // status 1 without user_verified = '1' means an admin un-verified them later.
  return { status: "none", rejectReason: null, submittedAt: null };
}

/**
 * The pose this user must do now: reuses the one already issued (so reopening
 * the screen doesn't reshuffle it), else picks a new random one.
 * @param {string} userId
 */
export async function issuePose(userId) {
  const key = `${namer.redis.verifyPose}${userId}`;
  const existing = await redisDo((client) => client.get(key));
  // @ts-ignore
  if (existing && VERIFICATION_POSES[existing]) return existing;
  const codes = Object.keys(VERIFICATION_POSES);
  const code = codes[Math.floor(Math.random() * codes.length)];
  await redisDo((client) => client.set(key, code, { EX: POSE_TTL_SECONDS }));
  return code;
}

/**
 * The pose issued to this user, consumed so it can only back one submission.
 * @param {string} userId
 */
export async function takeIssuedPose(userId) {
  return redisDo((client) =>
    client.getDel(`${namer.redis.verifyPose}${userId}`),
  );
}
