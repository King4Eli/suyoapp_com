import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  productListVariant,
  productLists,
  userPaymentNotices,
} from "../db/schema.js";
import { tools } from "./functions.js";

// User-facing wording for every payment / subscription event. The webhook and pay
// routes never send a generic "payment updated" -- each event says what actually
// happened to this person, with their plan, dates and amounts filled in.

/** @param {string | null | undefined} s */
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

/** @param {Date | string | number | null | undefined} d */
export const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

/**
 * @param {number} amount major units (e.g. 19.99)
 * @param {string} [currency]
 */
export const formatMoney = (amount, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
};

/**
 * @typedef {"success" | "info" | "warning" | "error"} NoticeTone
 * @typedef {{ tone: NoticeTone; title: string; body: string }} NoticeText
 * @typedef {{
 *   plan?: string; item?: string; until?: string; amount?: string;
 *   reason?: string; retryOn?: string; switchedFrom?: string;
 * }} NoticeVars
 */

/** @type {Record<string, (v: NoticeVars) => NoticeText>} */
const NOTICES = {
  subscription_activated: (v) => ({
    tone: "success",
    title: `Welcome to ${v.plan}!`,
    body: v.switchedFrom
      ? `You've switched from ${v.switchedFrom} to ${v.plan}. Your ${v.switchedFrom} plan was cancelled with unused time credited, and ${v.plan} is active until ${v.until}.`
      : `Your ${v.plan} plan is active until ${v.until}. All your ${v.plan} perks are unlocked now.`,
  }),
  subscription_processing: (v) => ({
    tone: "info",
    title: "Payment processing",
    body: `Your bank payment for ${v.plan} is being processed. We'll unlock ${v.plan} as soon as it clears -- this can take a few business days.`,
  }),
  subscription_payment_failed: (v) => ({
    tone: "error",
    title: "Payment didn't go through",
    body: `Your payment for ${v.plan} failed${v.reason ? `: ${v.reason}` : ""}. You haven't been charged -- try again with another payment method.`,
  }),
  subscription_renewed: (v) => ({
    tone: "success",
    title: `${v.plan} renewed`,
    body: `Your ${v.plan} plan renewed for ${v.amount}. It's active until ${v.until}.`,
  }),
  subscription_renewal_failed: (v) => ({
    tone: "warning",
    title: `We couldn't renew ${v.plan}`,
    body: `Your renewal payment failed${v.reason ? `: ${v.reason}` : ""}. We'll try again ${v.retryOn ? `on ${v.retryOn}` : "soon"} -- update your payment method to keep your ${v.plan} perks.`,
  }),
  subscription_ended_unpaid: (v) => ({
    tone: "error",
    title: `${v.plan} has ended`,
    body: `We couldn't collect payment for ${v.plan} after several tries, so it has ended. You can resubscribe anytime.`,
  }),
  subscription_cancel_scheduled: (v) => ({
    tone: "info",
    title: `${v.plan} won't renew`,
    body: `You'll keep ${v.plan} until ${v.until}. It won't renew after that, and you won't be charged again.`,
  }),
  subscription_resumed: (v) => ({
    tone: "success",
    title: `${v.plan} will renew`,
    body: `Your ${v.plan} plan will renew as usual on ${v.until}.`,
  }),
  subscription_ended: (v) => ({
    tone: "info",
    title: `${v.plan} has ended`,
    body: `Your ${v.plan} plan has ended. Upgrade again anytime to get your perks back.`,
  }),
  purchase_completed: (v) => ({
    tone: "success",
    title: `${cap(v.item)} added`,
    body: `Your ${v.item} ${v.item?.startsWith("1 ") ? "is" : "are"} ready to use.`,
  }),
  rewind_completed: () => ({
    tone: "success",
    title: "Match recovered",
    body: "Your rewind worked -- they're back in your Likes, so you can like them back.",
  }),
  rewind_refunded: (v) => ({
    tone: "info",
    title: "Rewind refunded",
    body: `That match was no longer available to recover, so we refunded your ${v.amount}.`,
  }),
  purchase_processing: (v) => ({
    tone: "info",
    title: "Payment processing",
    body: `Your bank payment for ${v.item} is being processed. We'll add it as soon as it clears.`,
  }),
  purchase_failed: (v) => ({
    tone: "error",
    title: "Payment didn't go through",
    body: `Your payment for ${v.item} failed${v.reason ? `: ${v.reason}` : ""}. You haven't been charged.`,
  }),
  payment_refunded: (v) => ({
    tone: "info",
    title: "Refund issued",
    body: `${v.amount} was refunded for ${v.item}. It can take 5-10 business days to show on your statement.`,
  }),
};

/**
 * What a product variant is, in words: the plan name for subscriptions, the pack
 * contents for one-time purchases.
 * @param {number | string} variantId
 */
export async function describeVariant(variantId) {
  const [row] = await db
    .select({
      productName: productLists.plName,
      category: productLists.category,
      tier: productLists.tier,
      variantName: productListVariant.name,
      description: productListVariant.description,
    })
    .from(productListVariant)
    .innerJoin(
      productLists,
      eq(productLists.plSku, productListVariant.productListsIdRef),
    )
    .where(eq(productListVariant.idAi, Number(variantId)))
    .limit(1);
  if (!row) return { category: null, plan: "your plan", item: "your purchase" };

  /** @type {any} */
  let d = row.description;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      d = {};
    }
  }
  /** @param {number} n @param {string} one @param {string} many */
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  let item = `${row.variantName}`;
  if (row.category === "superlike" && d?.roses)
    item = count(Number(d.roses), "rose", "roses");
  else if (row.category === "directmessage" && d?.directMessages)
    item = count(Number(d.directMessages), "direct message", "direct messages");
  else if (row.category === "boost" && d?.boosts)
    item = count(Number(d.boosts), "boost", "boosts");
  else if (row.category === "rewind") item = "a rewind";

  return {
    category: row.category,
    tier: row.tier,
    plan: row.tier
      ? cap(row.tier === "vip" ? "VIP" : row.tier)
      : cap(row.productName),
    item,
  };
}

/**
 * Records a payment event for the user and pings their socket room so an open app
 * can show it right away. Best-effort: a notice failing must never fail the
 * payment processing that triggered it.
 * @param {import("socket.io").Server | undefined} io
 * @param {string} userId
 * @param {keyof typeof NOTICES} kind
 * @param {NoticeVars} vars
 * @param {string | null} [paymentId]
 */
export async function createPaymentNotice(io, userId, kind, vars, paymentId) {
  if (!userId || !NOTICES[kind]) return;
  try {
    const text = NOTICES[kind](vars);
    const id = tools.generateAlphanumeric(20, 30);
    await db.insert(userPaymentNotices).values({
      id,
      userId,
      kind,
      tone: text.tone,
      title: text.title.slice(0, 120),
      body: text.body.slice(0, 500),
      paymentId: paymentId ?? null,
    });
    io?.to(`user-${userId}`).emit("payment-event", {
      id,
      kind,
      ...text,
      paymentId: paymentId ?? null,
    });
  } catch (err) {
    tools.serverLog(
      `Failed to create payment notice ${kind} for ${userId}: ${err}`,
      "paymentNotices-1",
    );
  }
}

/**
 * The user's unseen notices, oldest first, marked seen as they're handed out so
 * each one is shown once.
 * @param {string} userId
 */
export async function takeUnseenPaymentNotices(userId) {
  const rows = await db
    .select({
      id: userPaymentNotices.id,
      kind: userPaymentNotices.kind,
      tone: userPaymentNotices.tone,
      title: userPaymentNotices.title,
      body: userPaymentNotices.body,
      paymentId: userPaymentNotices.paymentId,
      createdAt: userPaymentNotices.createdAt,
    })
    .from(userPaymentNotices)
    .where(
      and(
        eq(userPaymentNotices.userId, userId),
        eq(userPaymentNotices.seen, 0),
      ),
    )
    .orderBy(desc(userPaymentNotices.createdAt))
    .limit(10);
  if (rows.length > 0) {
    await db
      .update(userPaymentNotices)
      .set({ seen: 1 })
      .where(
        inArray(
          userPaymentNotices.id,
          rows.map((r) => r.id),
        ),
      );
  }
  return rows.reverse();
}

/**
 * Latest notice tied to one payment, for the checkout-return screen.
 * @param {string} userId
 * @param {string} paymentId
 */
export async function getNoticeForPayment(userId, paymentId) {
  const [row] = await db
    .select({
      id: userPaymentNotices.id,
      kind: userPaymentNotices.kind,
      tone: userPaymentNotices.tone,
      title: userPaymentNotices.title,
      body: userPaymentNotices.body,
    })
    .from(userPaymentNotices)
    .where(
      and(
        eq(userPaymentNotices.userId, userId),
        eq(userPaymentNotices.paymentId, paymentId),
      ),
    )
    .orderBy(desc(userPaymentNotices.createdAt))
    .limit(1);
  return row ?? null;
}
