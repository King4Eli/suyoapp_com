import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { payments, users, userVerifications } from "../db/schema.js";
import { namer } from "./namer.js";
import { redisDo } from "./redisClient.js";
import { tools } from "./functions.js";
import { communicateWith } from "./sendingCommunicate.js";
import { emailTemplates } from "./emailTemplates.js";
import { formatDate, formatMoney } from "./paymentNotices.js";

// Who gets which email. Two kinds:
// - account emails (security alerts, receipts, billing, verification results) are
//   always sent -- people need them whatever their settings say;
// - activity emails (likes, matches, messages) follow Settings > Notifications:
//   the email toggle (users.user_notify_email) and that category's email toggle
//   (users.user_notify_email_<category>).
//   They only go to people who aren't in the app right now (the socket already
//   told them), and are throttled.
// Everything here is best-effort: an email failing must never fail the action
// that triggered it, so callers don't await these and errors are only logged.

const LIKE_EMAIL_EVERY_SECONDS = 6 * 60 * 60;
const MESSAGE_EMAIL_EVERY_SECONDS = 3 * 60 * 60;

/** users.user_email is NULL until the user adds an address in Settings. */
const isRealEmail = (/** @type {string | null | undefined} */ e) =>
  tools.validateIsEmail(e ?? "");

/** @param {string} userId */
async function recipient(userId) {
  const [row] = await db
    .select({
      email: users.userEmail,
      name: users.userFullname,
      active: users.userActive,
      notifyEmail: users.userNotifyEmail,
      notifyLikes: users.userNotifyEmailLikes,
      notifyMatches: users.userNotifyEmailMatches,
      notifyMessages: users.userNotifyEmailMessages,
    })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * True the first time it's called for `key` within `ttlSeconds` -- used both to
 * send an email once and to throttle repeats.
 * @param {string} key
 * @param {number} ttlSeconds
 */
async function firstTime(key, ttlSeconds) {
  const set = await redisDo((client) =>
    client.set(`${namer.redis.emailOnce}${key}`, "1", {
      NX: true,
      EX: ttlSeconds,
    }),
  );
  return set === "OK";
}

/**
 * @param {import("socket.io").Server | undefined} io
 * @param {string} userId
 */
async function isOnline(io, userId) {
  if (!io) return false;
  const sockets = await io.in(`user-${userId}`).fetchSockets();
  return sockets.length > 0;
}

/**
 * @param {string} to
 * @param {{ subject: string; html: string; text: string }} mail
 * @param {string} what for the log
 */
async function send(to, mail, what) {
  const result = await communicateWith.sendEmail(
    null,
    to,
    mail.subject,
    mail.html,
    mail.text,
  );
  if (!result || result.code !== 200) {
    tools.serverLog(
      `Email "${what}" to ${tools.maskEmail(to)} not sent: ${result ? result.message : "SMTP not configured"}`,
      "notifyEmail-1",
    );
  }
  return result;
}

/**
 * Runs an email job in the background, logging instead of throwing.
 * @param {string} what
 * @param {() => Promise<unknown>} job
 */
function background(what, job) {
  job().catch((err) =>
    tools.serverLog(`Email "${what}" failed: ${err}`, "notifyEmail-0"),
  );
}

/**
 * An account email to a user who hasn't deleted their account.
 * @param {string} userId
 * @param {string} what
 * @param {(r: NonNullable<Awaited<ReturnType<typeof recipient>>>) => { subject: string; html: string; text: string }} build
 */
function accountEmail(userId, what, build) {
  background(what, async () => {
    const r = await recipient(userId);
    if (!r || r.active === "-99" || !isRealEmail(r.email)) return;
    await send(r.email, build(r), what);
  });
}

/** Which recipient() flag gates each activity category. */
const CATEGORY_FLAG = /** @type {const} */ ({
  likes: "notifyLikes",
  matches: "notifyMatches",
  messages: "notifyMessages",
});

/**
 * An activity email: respects the email and category toggles, skips
 * people in the app, and only sends if `onceKey` hasn't fired within `ttlSeconds`.
 * @param {import("socket.io").Server | undefined} io
 * @param {string} userId
 * @param {keyof typeof CATEGORY_FLAG} category
 * @param {string} what
 * @param {string} onceKey
 * @param {number} ttlSeconds
 * @param {(r: NonNullable<Awaited<ReturnType<typeof recipient>>>) => Promise<{ subject: string; html: string; text: string } | null>} build
 */
function activityEmail(io, userId, category, what, onceKey, ttlSeconds, build) {
  background(what, async () => {
    const r = await recipient(userId);
    if (!r || r.active !== "1" || r.notifyEmail !== "1") return;
    if (r[CATEGORY_FLAG[category]] !== "1") return;
    if (!isRealEmail(r.email)) return;
    if (await isOnline(io, userId)) return;
    if (!(await firstTime(onceKey, ttlSeconds))) return;
    const mail = await build(r);
    if (mail) await send(r.email, mail, what);
  });
}

/** @param {string} userId */
async function firstNameOf(userId) {
  const [row] = await db
    .select({ name: users.userFullname })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  return (
    String(row?.name ?? "")
      .trim()
      .split(/\s+/)[0] ?? ""
  );
}

export const notifyEmail = {
  // ── account ────────────────────────────────────────────────────────────────

  /**
   * Sent to the address that was just replaced, plus a confirmation to the new one.
   * @param {string} oldEmail
   * @param {string} newEmail
   */
  emailChanged(oldEmail, newEmail) {
    background("email_changed", async () => {
      if (isRealEmail(oldEmail) && oldEmail !== newEmail) {
        await send(
          oldEmail,
          emailTemplates.emailChangedOld({
            newEmail: tools.maskEmail(newEmail),
          }),
          "email_changed_old",
        );
      }
      if (isRealEmail(newEmail)) {
        await send(
          newEmail,
          emailTemplates.emailChangedNew(),
          "email_changed_new",
        );
      }
    });
  },

  /**
   * @param {string} userId
   * @param {string} newPhone
   */
  phoneChanged(userId, newPhone) {
    accountEmail(userId, "phone_changed", () =>
      emailTemplates.phoneChanged({
        lastDigits: String(newPhone).replace(/\D/g, "").slice(-2),
      }),
    );
  },

  /**
   * The account row is already marked deleted by now, so the address is passed in.
   * @param {string} email
   * @param {string} name
   */
  accountDeleted(email, name) {
    background("account_deleted", async () => {
      if (!isRealEmail(email)) return;
      await send(
        email,
        emailTemplates.accountDeleted({
          name: String(name ?? "").split(" ")[0],
        }),
        "account_deleted",
      );
    });
  },

  /**
   * Payment/subscription event (paymentNotices.js wording). Successful, failed
   * and refunded payments carry a details table (receiptRows).
   * @param {string} userId
   * @param {string} kind
   * @param {{ title: string; body: string; tone: "success" | "info" | "warning" | "error" }} text
   * @param {{ plan?: string; item?: string; until?: string; amount?: string; reason?: string; retryOn?: string }} vars
   * @param {string | null} [paymentId]
   */
  payment(userId, kind, text, vars, paymentId) {
    background(`payment_${kind}`, async () => {
      // One email per payment event even if the webhook is replayed.
      const once = paymentId ? `pay:${paymentId}:${kind}` : null;
      const record = RECORD_KIND[kind];
      const rows = record
        ? await receiptRows(record, kind, vars, paymentId)
        : undefined;
      const r = await recipient(userId);
      if (!r || r.active === "-99" || !isRealEmail(r.email)) return;
      if (once && !(await firstTime(once, 30 * 24 * 60 * 60))) return;
      await send(
        r.email,
        emailTemplates.payment({ ...text, record, rows }),
        `payment_${kind}`,
      );
    });
  },

  // ── activity ───────────────────────────────────────────────────────────────

  /**
   * @param {import("socket.io").Server | undefined} io
   * @param {string} userId who was liked
   * @param {boolean} isSuperlike
   */
  newLike(io, userId, isSuperlike) {
    activityEmail(
      io,
      userId,
      "likes",
      "new_like",
      `like:${userId}`,
      LIKE_EMAIL_EVERY_SECONDS,
      async () => emailTemplates.newLike({ isSuperlike }),
    );
  },

  /**
   * @param {import("socket.io").Server | undefined} io
   * @param {string} userId who gets the email
   * @param {string} otherUserId who they matched with
   * @param {string} matchId
   */
  newMatch(io, userId, otherUserId, matchId) {
    activityEmail(
      io,
      userId,
      "matches",
      "new_match",
      `match:${matchId}:${userId}`,
      7 * 24 * 60 * 60,
      async () =>
        emailTemplates.newMatch({ name: await firstNameOf(otherUserId) }),
    );
  },

  /**
   * @param {import("socket.io").Server | undefined} io
   * @param {string} userId who received the message
   * @param {string} senderId
   * @param {string} matchId
   */
  newMessage(io, userId, senderId, matchId) {
    activityEmail(
      io,
      userId,
      "messages",
      "new_message",
      `msg:${matchId}:${userId}`,
      MESSAGE_EMAIL_EVERY_SECONDS,
      async () =>
        emailTemplates.newMessage({ name: await firstNameOf(senderId) }),
    );
  },
};

// ── receipts ───────────────────────────────────────────────────────────────────

// Which payment events get a details table, and what kind of record it is.
/** @type {Record<string, "paid" | "failed" | "refund">} */
const RECORD_KIND = {
  subscription_activated: "paid",
  subscription_renewed: "paid",
  purchase_completed: "paid",
  rewind_completed: "paid",
  subscription_payment_failed: "failed",
  purchase_failed: "failed",
  subscription_renewal_failed: "failed",
  subscription_ended_unpaid: "failed",
  payment_refunded: "refund",
  rewind_refunded: "refund",
};

/**
 * The details table for a payment email: what it was for, the amount, date,
 * outcome and reference. Amounts come from the payment row when there is one,
 * otherwise from the event (renewal invoices have no payment row until paid).
 * @param {"paid" | "failed" | "refund"} record
 * @param {string} kind
 * @param {{ plan?: string; item?: string; until?: string; amount?: string; reason?: string; retryOn?: string }} vars
 * @param {string | null | undefined} paymentId
 * @returns {Promise<[string, string][] | undefined>}
 */
async function receiptRows(record, kind, vars, paymentId) {
  const [p] = paymentId
    ? await db
        .select({
          amount: payments.pAmount,
          currency: payments.pCurrency,
          createdAt: payments.pCreatedAt,
        })
        .from(payments)
        .where(eq(payments.paymentId, paymentId))
        .limit(1)
    : [];
  const paymentAmount = p
    ? formatMoney(parseFloat(p.amount), p.currency ?? "USD")
    : undefined;
  const isPlan = kind.startsWith("subscription_");
  /** @type {[string, string][]} */
  const rows = [
    [
      isPlan ? "Plan" : "Item",
      (isPlan ? vars.plan : vars.item) ??
        (isPlan ? "Your plan" : "Your purchase"),
    ],
  ];

  if (record === "paid") {
    if (!paymentAmount) return undefined;
    rows.push(["Amount paid", paymentAmount]);
    rows.push(["Date", formatDate(p?.createdAt)]);
    if (isPlan && vars.until) rows.push(["Active until", vars.until]);
  } else if (record === "failed") {
    const amount = vars.amount ?? paymentAmount;
    if (amount) rows.push(["Amount", amount]);
    rows.push(["Date", formatDate(Date.now())]);
    rows.push([
      "Status",
      kind === "subscription_ended_unpaid"
        ? "Unpaid — plan ended"
        : "Failed — not charged",
    ]);
    if (vars.reason) rows.push(["Reason", vars.reason]);
    if (vars.retryOn) rows.push(["Next attempt", vars.retryOn]);
  } else {
    const amount = vars.amount ?? paymentAmount;
    if (amount) rows.push(["Amount refunded", amount]);
    rows.push(["Date", formatDate(Date.now())]);
  }

  if (paymentId) rows.push(["Reference", paymentId]);
  return rows;
}

// ── verification results ───────────────────────────────────────────────────────

// Selfie reviews happen in the PHP admin (admin/pages/verifications.php), which
// can't send mail or reach sockets, so the API picks up recently reviewed
// requests and, once each, emails the result and tells the app over the socket
// ("verification-event") so an open app updates without a restart.
const VERIFICATION_POLL_MS = 60 * 1000;

/** @param {import("socket.io").Server | undefined} io */
async function emailReviewedVerifications(io) {
  try {
    const reviewed = await db
      .select({
        id: userVerifications.id,
        userId: userVerifications.userId,
        status: userVerifications.status,
        reason: userVerifications.rejectReason,
      })
      .from(userVerifications)
      .where(
        and(
          inArray(userVerifications.status, [1, 2]),
          gt(userVerifications.reviewedAt, sql`NOW() - INTERVAL 2 HOUR`),
        ),
      );
    for (const v of reviewed) {
      if (!(await firstTime(`verification:${v.id}`, 7 * 24 * 60 * 60)))
        continue;
      io?.to(`user-${v.userId}`).emit("verification-event", {
        status: v.status === 1 ? "verified" : "rejected",
        reason: v.status === 1 ? null : (v.reason ?? null),
      });
      accountEmail(v.userId, "verification_result", () =>
        v.status === 1
          ? emailTemplates.verificationApproved()
          : emailTemplates.verificationRejected({ reason: v.reason ?? "" }),
      );
    }
  } catch (err) {
    tools.serverLog(
      `Error emailing verification results: ${err}`,
      "notifyEmail-2",
    );
  }
}

/** @param {import("socket.io").Server} io */
export function startVerificationEmailJob(io) {
  emailReviewedVerifications(io);
  setInterval(() => emailReviewedVerifications(io), VERIFICATION_POLL_MS);
}
