// Boost, payments (webhook fulfilment), verification, feed, reports, uploads,
// badges, streaks and the app log endpoint.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import {
  core,
  createUser,
  giveBoosts,
  post,
  query,
  resetData,
  setPlan,
} from "./helpers.js";

beforeEach(resetData);

// ── Boost ───────────────────────────────────────────────────────────────────

test("boost: none available is refused with no_boosts", async () => {
  const user = await createUser();
  const res = await core("pushBoost", {}, user);
  assert.equal(res.code, 402);
  assert.equal(res.reason, "no_boosts");
});

test("boost: spends one purchased boost and runs 30 minutes; can't stack", async () => {
  const user = await createUser();
  await giveBoosts(user.id, 2);
  const res = await core("pushBoost", {}, user);
  assert.equal(res.code, 200, res.message);
  assert.equal(res.boosts.balance, 1);
  const minutesLeft =
    (new Date(res.boosts.activeUntil).getTime() - Date.now()) / 60000;
  assert.ok(
    minutesLeft > 29 && minutesLeft <= 30,
    `minutes left ${minutesLeft}`,
  );

  const again = await core("pushBoost", {}, user);
  assert.equal(again.code, 409, "a second boost isn't spent while one runs");
  assert.equal(again.boosts.balance, 1);
});

test("boost: Plus uses the free weekly boost before purchased ones", async () => {
  const user = await createUser();
  await setPlan(user.id, "plus");
  await giveBoosts(user.id, 3);
  const res = await core("pushBoost", {}, user);
  assert.equal(res.code, 200);
  assert.equal(res.boosts.balance, 3, "purchased balance untouched");
  assert.equal(res.boosts.weekly.available, false);
  assert.ok(res.boosts.weekly.nextAt, "says when the weekly boost is back");
});

test("boost: concurrent taps spend exactly one", async () => {
  const user = await createUser();
  await giveBoosts(user.id, 5);
  const results = await Promise.all(
    [1, 2, 3, 4].map(() => core("pushBoost", {}, user)),
  );
  assert.equal(results.filter((r) => r.code === 200).length, 1);
  const [row] = await query(
    "SELECT boost_balance FROM user_boost_usage WHERE user_id = ?",
    [user.id],
  );
  assert.equal(row.boost_balance, 4);
});

// ── Payments: Stripe webhook ────────────────────────────────────────────────

const stripe = new Stripe(String(process.env.STRIPE_SECRET_KEY));

/** Posts a correctly signed Stripe webhook event. @param {any} event */
async function sendWebhook(
  event,
  secret = String(process.env.STRIPE_SIGNING_SECRET),
) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  const { baseUrl } = await import("./helpers.js");
  const res = await fetch(`${baseUrl}/api/secure/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  return { status: res.status, body: await res.text() };
}

/** A pending one-time payment for the "5 boosts" pack. @param {string} userId */
async function pendingBoostPurchase(userId) {
  const [variant] = await query(
    `SELECT v.id_ai, v.price FROM product_list_variant v
       JOIN product_lists p ON p.pl_sku = v.product_lists_id_ref
     WHERE p.category = 'boost' AND v.name = '5 boosts'`,
  );
  const paymentId = `pay_${userId}`;
  await query(
    "INSERT INTO payments (payment_id, p_amount, type, status, user_id_ref, variant_ref) VALUES (?, ?, 2, 0, ?, ?)",
    [paymentId, variant.price, userId, variant.id_ai],
  );
  return {
    paymentId,
    variantId: variant.id_ai,
    cents: Math.round(Number(variant.price) * 100),
  };
}

/** @param {string} userId @param {{ paymentId: string; variantId: number; cents: number }} p */
const checkoutCompleted = (userId, p, eventId = `evt_${userId}`) => ({
  id: eventId,
  type: "checkout.session.completed",
  data: {
    object: {
      id: `cs_${userId}`,
      mode: "payment",
      payment_status: "paid",
      amount_total: p.cents,
      payment_intent: `pi_${userId}`,
      metadata: {
        paymentId: p.paymentId,
        userId,
        sku_variant: String(p.variantId),
      },
    },
  },
});

test("webhook: rejects a bad signature", async () => {
  const res = await sendWebhook(
    { id: "evt_x", type: "ping", data: { object: {} } },
    "whsec_wrong",
  );
  assert.equal(res.status, 400);
});

test("webhook: a paid boost checkout grants the boosts exactly once", async () => {
  const user = await createUser();
  const purchase = await pendingBoostPurchase(user.id);
  const event = checkoutCompleted(user.id, purchase);

  const first = await sendWebhook(event);
  assert.equal(first.status, 200, first.body);
  const replay = await sendWebhook(event);
  assert.equal(replay.status, 200, "replays are acknowledged");

  const [usage] = await query(
    "SELECT boost_balance FROM user_boost_usage WHERE user_id = ?",
    [user.id],
  );
  assert.equal(usage.boost_balance, 5);
  const [payment] = await query(
    "SELECT status FROM payments WHERE payment_id = ?",
    [purchase.paymentId],
  );
  assert.equal(payment.status, 1, "payment marked completed");

  const notices = await core("getPaymentNotices", {}, user);
  assert.equal(notices.code, 200);
  assert.ok(
    JSON.stringify(notices).includes("5 boosts"),
    "user is told what they got",
  );
});

test("webhook: metadata that doesn't match the payment grants nothing", async () => {
  const user = await createUser();
  const other = await createUser();
  const purchase = await pendingBoostPurchase(user.id);
  const res = await sendWebhook(checkoutCompleted(other.id, purchase));
  assert.equal(res.status, 200);
  const rows = await query("SELECT boost_balance FROM user_boost_usage");
  assert.equal(rows.length, 0);
});

test("payment history and status endpoints answer", async () => {
  const user = await createUser();
  const purchase = await pendingBoostPurchase(user.id);
  assert.equal((await core("getPaymentHistory", {}, user)).code, 200);
  const status = await core(
    "getPaymentStatus",
    { paymentId: purchase.paymentId },
    user,
  );
  assert.equal(status.code, 200, status.message);
  const stranger = await createUser();
  const peek = await core(
    "getPaymentStatus",
    { paymentId: purchase.paymentId },
    stranger,
  );
  assert.notEqual(peek.code, 200, "can't read someone else's payment");
});

// ── Verification ────────────────────────────────────────────────────────────

test("verification: pose issued, selfie submitted, then pending", async () => {
  const user = await createUser();
  const state = await core("getVerification", {}, user);
  assert.equal(state.code, 200);
  assert.equal(state.status, "none");
  assert.ok(state.pose?.code, "a pose to copy");

  const bad = await core(
    "pushVerification",
    { selfiePath: "/users/someone_else/verify/a.jpg", pose: state.pose.code },
    user,
  );
  assert.equal(bad.code, 400, "selfie must be in the caller's own folder");

  const ok = await core(
    "pushVerification",
    {
      selfiePath: `/users/${user.id}/verify/selfie.jpg`,
      pose: state.pose.code,
    },
    user,
  );
  assert.equal(ok.code, 200, ok.message);
  assert.equal((await core("getVerification", {}, user)).status, "pending");

  const twice = await core(
    "pushVerification",
    { selfiePath: `/users/${user.id}/verify/again.jpg`, pose: state.pose.code },
    user,
  );
  assert.equal(twice.code, 409);
});

test("verification: a stale pose is refused", async () => {
  const user = await createUser();
  await core("getVerification", {}, user);
  const res = await core(
    "pushVerification",
    { selfiePath: `/users/${user.id}/verify/s.jpg`, pose: "not-the-pose" },
    user,
  );
  assert.equal(res.code, 409);
  assert.equal(res.reason, "pose_expired");
});

// ── Feed ────────────────────────────────────────────────────────────────────

test("feed: post, react, comment, list, and delete", async () => {
  const author = await createUser();
  const reader = await createUser();
  const post1 = await core("pushFeedPost", { caption: "First post" }, author);
  assert.equal(post1.code, 200, post1.message);

  assert.equal(
    (
      await core(
        "pushFeedReaction",
        { post_id: post1.postId, reaction: "love" },
        author,
      )
    ).code,
    400,
    "can't react to own post",
  );
  const react = await core(
    "pushFeedReaction",
    { post_id: post1.postId, reaction: "love" },
    reader,
  );
  assert.equal(react.code, 200, react.message);
  assert.equal(react.reactionCount, 1);
  const again = await core(
    "pushFeedReaction",
    { post_id: post1.postId, reaction: "like" },
    reader,
  );
  assert.equal(again.reactionCount, 1, "one reaction per person");

  const comment = await core(
    "pushFeedComment",
    { post_id: post1.postId, text: "Nice!" },
    reader,
  );
  assert.equal(comment.code, 200, comment.message);
  const comments = await core(
    "getFeedComments",
    { post_id: post1.postId },
    author,
  );
  assert.equal(comments.comments.length, 1);

  const feed = await core("getFeed", {}, reader);
  assert.equal(feed.code, 200);
  assert.ok(
    feed.feedPosts.some((/** @type {any} */ p) => p.post_id === post1.postId),
  );

  assert.equal(
    (
      await core(
        "pushDeleteFeedComment",
        { comment_id: comment.commentId },
        author,
      )
    ).code,
    403,
  );
  assert.equal(
    (
      await core(
        "pushDeleteFeedComment",
        { comment_id: comment.commentId },
        reader,
      )
    ).code,
    200,
  );
  assert.equal(
    (await core("pushDeleteFeedPost", { post_id: post1.postId }, reader)).code,
    403,
  );
  assert.equal(
    (await core("pushDeleteFeedPost", { post_id: post1.postId }, author)).code,
    200,
  );
});

test("feed: an empty post is refused", async () => {
  const user = await createUser();
  assert.equal((await core("pushFeedPost", { caption: "  " }, user)).code, 400);
});

// ── Reports ─────────────────────────────────────────────────────────────────

test("report a user", async () => {
  const reporter = await createUser();
  const bad = await createUser();
  const res = await core(
    "pushReportUser",
    { reportedUserId: bad.id, reason: "spam" },
    reporter,
  );
  assert.equal(res.code, 200, res.message);
  const [row] = await query(
    "SELECT reporter_user_id FROM users_reported WHERE user_id = ?",
    [bad.id],
  );
  assert.equal(row.reporter_user_id, reporter.id);
  assert.equal((await core("pushReportUser", {}, reporter)).code, 400);
});

// ── Uploads ─────────────────────────────────────────────────────────────────

test("uploads: presigned URL for your own profile media", async () => {
  const user = await createUser();
  const res = await core(
    "handleFileUpload",
    { meta: { extension: "jpg", bucketType: "profile-media" } },
    user,
  );
  assert.equal(res.code, 200, res.message);
  assert.ok(res.data.fileKey.startsWith(`users/${user.id}/profile_media/`));
  assert.ok(res.data.uploadUrl);
});

test("uploads: bad type or extension is refused", async () => {
  const user = await createUser();
  assert.equal(
    (
      await core(
        "handleFileUpload",
        { meta: { extension: "exe", bucketType: "profile-media" } },
        user,
      )
    ).code,
    400,
  );
  assert.equal(
    (
      await core(
        "handleFileUpload",
        { meta: { extension: "jpg", bucketType: "nope" } },
        user,
      )
    ).code,
    400,
  );
});

test("uploads: only into conversations you're part of", async () => {
  const a = await createUser();
  const b = await createUser();
  const outsider = await createUser();
  const like = await core(
    "pushPeopleToMatch",
    { user_id2: b.id, match_status: 0 },
    a,
  );
  await core("pushPeopleToMatch", { user_id2: a.id, match_status: 0 }, b);

  const ok = await core(
    "handleFileUpload",
    {
      meta: {
        extension: "jpg",
        bucketType: "convo-img",
        convoId: like.matchId,
      },
    },
    a,
  );
  assert.equal(ok.code, 200, ok.message);
  const intruder = await core(
    "handleFileUpload",
    {
      meta: {
        extension: "jpg",
        bucketType: "convo-img",
        convoId: like.matchId,
      },
    },
    outsider,
  );
  assert.equal(intruder.code, 403);
  const traversal = await core(
    "handleFileUpload",
    {
      meta: {
        extension: "jpg",
        bucketType: "convo-img",
        convoId: "../users/x",
      },
    },
    a,
  );
  assert.equal(traversal.code, 403);
});

test("uploads: signed-out signup uploads are allowed", async () => {
  const res = await post("/api/core/v1/handleFileUpload", {
    meta: { extension: "jpg", bucketType: "signup-void" },
  });
  assert.equal(res.json.code, 200, res.json.message);
});

// ── Badges, streaks ─────────────────────────────────────────────────────────

test("badge counts reflect new likes", async () => {
  const me = await createUser();
  const liker = await createUser();
  await core("pushPeopleToMatch", { user_id2: me.id, match_status: 0 }, liker);
  const res = await core("getBadgeCounts", {}, me);
  assert.equal(res.code, 200);
  assert.ok(JSON.stringify(res).includes("1"), JSON.stringify(res));
});

test("streak: nothing to claim without a completed streak", async () => {
  const user = await createUser();
  assert.equal((await core("pushClaimStreakReward", {}, user)).code, 404);
});

// ── App logs ────────────────────────────────────────────────────────────────

test("logs: stores the app version that wrote each log, signed in or not", async () => {
  const user = await createUser();
  const scripts = JSON.stringify([
    {
      type: "function",
      uid: user.id,
      app: { version_app: "1.2.0", buildNumber_app: "34" },
      _error: { useraction: "x" },
    },
    { type: "http", app: { version_app: "1.1.0" } },
  ]);
  const res = await post("/api/core/v1/pushLogReport", { scripts }, user.token);
  assert.equal(res.status, 200, res.text);
  assert.equal(res.json.inserted, 2);
  const rows = await query(
    "SELECT app_version, report_currentuser FROM logs_application ORDER BY app_version DESC",
  );
  assert.deepEqual(
    rows.map((/** @type {any} */ r) => r.app_version),
    ["1.2.0 (34)", "1.1.0"],
  );
  assert.equal(
    rows[0].report_currentuser,
    user.id,
    "attributed only when uid matches the session",
  );
  assert.equal(
    rows[1].report_currentuser,
    user.id,
    "legacy entries without uid use the session",
  );

  const anonymous = await post("/api/core/v1/pushLogReport", {
    scripts: JSON.stringify({ type: "boot" }),
  });
  assert.equal(anonymous.status, 200);
});
