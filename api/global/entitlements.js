import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  payments,
  productListVariant,
  productLists,
  subscriptions,
  userBoostUsage,
  userRoseUsage,
} from "../db/schema.js";
import { envInt } from "./functions.js";

// Single source of truth for the free-tier daily like cap, shared by pushPeopleToMatch.js
// (which enforces it) and getProfile.js (which displays "remaining today" from it) --
// these used to hardcode two different numbers (20 vs 15), silently drifting apart.
export const FREE_LIKE_DAILY_LIMIT = envInt("LIKES_DAILY_FREE_LIMIT", 20);
export const FREE_LIKE_WINDOW_SECONDS = envInt(
  "LIKES_DAILY_WINDOW_SECONDS",
  24 * 60 * 60,
);

/**
 * The caller's current active (paid-through) subscription, or null if none.
 * @param {string} userId
 */
export async function getActiveSubscription(userId) {
  const [subData] = await db
    .select({
      subscriptionId: subscriptions.id,
      variantIdRef: subscriptions.variantIdRef,
      startDate: subscriptions.startDate,
      endDate: subscriptions.endDate,
      externalPlatform: subscriptions.externalPlatform,
      externalId: subscriptions.externalId,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      planName: productListVariant.name,
      planDescription: productListVariant.description,
      planPrice: productListVariant.price,
      billingCycle: productListVariant.billingCycle,
      productName: productLists.plName,
      productDescription: productLists.plDescription,
      paymentId: payments.paymentId,
      paymentStatus: payments.status,
      paymentAmount: payments.pAmount,
      paymentCurrency: payments.pCurrency,
    })
    .from(subscriptions)
    .leftJoin(
      productListVariant,
      eq(subscriptions.variantIdRef, productListVariant.idAi),
    )
    .leftJoin(
      productLists,
      eq(productListVariant.productListsIdRef, productLists.plSku),
    )
    .leftJoin(payments, eq(subscriptions.paymentIdRef, payments.paymentId))
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 1),
        gt(subscriptions.endDate, sql`NOW()`),
      ),
    )
    .orderBy(desc(subscriptions.dateCreated))
    .limit(1);

  if (!subData) {
    return null;
  }

  return {
    id: subData.subscriptionId,
    variant_id: subData.variantIdRef,
    plan_name: subData.planName,
    plan_description: subData.planDescription,
    plan_price: parseFloat(subData.planPrice),
    billing_cycle: subData.billingCycle,
    product_name: subData.productName,
    product_description: subData.productDescription,
    platform: subData.externalPlatform,
    external_id: subData.externalId,
    payment_id: subData.paymentId,
    payment_status: subData.paymentStatus,
    payment_amount: parseFloat(subData.paymentAmount),
    payment_currency: subData.paymentCurrency,
    start_date: subData.startDate,
    end_date: subData.endDate,
    status: "active",
    cancel_at_period_end: Boolean(subData.cancelAtPeriodEnd),
    days_remaining: Math.max(
      0,
      Math.ceil(
        (new Date(subData.endDate)?.getTime() - new Date()?.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    ),
  };
}

// ── Plan policy ─────────────────────────────────────────────────────────────
// The one place that says what each subscription tier may do. Every server-side
// gate reads from here (via getEntitlements / hasFeature) -- never compare tier
// names inline in a router, and never trust the client's idea of the plan.
// VIP is a superset of Plus, which is a superset of Free.
export const TIERS = /** @type {const} */ (["free", "plus", "vip"]);

/**
 * @typedef {typeof TIERS[number]} Tier
 * @typedef {{
 *   unlimitedLikes: boolean;
 *   seeWhoLikedYou: boolean;
 *   advancedFilters: boolean;
 *   freeRewind: boolean;
 *   readReceipts: boolean;
 *   viewSocialLinks: boolean;
 *   dailyRoses: number;
 * }} PlanFeatures
 * @typedef {Exclude<keyof PlanFeatures, "dailyRoses">} FeatureFlag
 */

/** @type {Record<Tier, PlanFeatures>} */
export const PLAN_FEATURES = {
  free: {
    unlimitedLikes: false,
    seeWhoLikedYou: false,
    advancedFilters: false,
    freeRewind: false,
    readReceipts: false,
    viewSocialLinks: false,
    dailyRoses: 2,
  },
  plus: {
    unlimitedLikes: true,
    seeWhoLikedYou: true,
    advancedFilters: true,
    freeRewind: true,
    readReceipts: false,
    viewSocialLinks: false,
    dailyRoses: 5,
  },
  vip: {
    unlimitedLikes: true,
    seeWhoLikedYou: true,
    advancedFilters: true,
    freeRewind: true,
    readReceipts: true,
    viewSocialLinks: true,
    dailyRoses: 10,
  },
};

/**
 * The caller's tier, read from product_lists.tier of their active subscription --
 * not from the product's display name, which is free to change without
 * silently revoking (or granting) access.
 * @param {string} userId
 * @returns {Promise<Tier>}
 */
export async function getSubscriptionTier(userId) {
  if (!userId) return "free";
  const [row] = await db
    .select({ tier: productLists.tier })
    .from(subscriptions)
    .innerJoin(
      productListVariant,
      eq(subscriptions.variantIdRef, productListVariant.idAi),
    )
    .innerJoin(
      productLists,
      eq(productListVariant.productListsIdRef, productLists.plSku),
    )
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 1),
        gt(subscriptions.endDate, sql`NOW()`),
        eq(productLists.category, "mainsub"),
      ),
    )
    .orderBy(desc(subscriptions.dateCreated))
    .limit(1);
  const tier = row?.tier;
  return tier === "plus" || tier === "vip" ? tier : "free";
}

/**
 * @param {string} userId
 * @returns {Promise<{ tier: Tier; features: PlanFeatures }>}
 */
export async function getEntitlements(userId) {
  const tier = await getSubscriptionTier(userId);
  return { tier, features: PLAN_FEATURES[tier] };
}

/**
 * @param {string} userId
 * @param {FeatureFlag} feature
 */
export async function hasFeature(userId, feature) {
  const { features } = await getEntitlements(userId);
  return features[feature] === true;
}

/**
 * Today's rose usage/allowance/balance snapshot for display purposes (does not spend anything).
 * `user_rose_usage` has one row per user; `daily_used` only counts if `daily_reset_date`
 * is today, since nothing proactively zeroes it out overnight.
 * @param {string} userId
 */
export async function getRoseStatus(userId) {
  const { tier, features } = await getEntitlements(userId);
  // Daily roses reset at UTC midnight; purchased balance never expires.
  const dailyAllowance = features.dailyRoses;

  const [row] = await db
    .select({
      roseBalance: userRoseUsage.roseBalance,
      effectiveDailyUsed:
        sql`IF(${userRoseUsage.dailyResetDate} = CURRENT_DATE, ${userRoseUsage.dailyUsed}, 0)`.mapWith(
          Number,
        ),
    })
    .from(userRoseUsage)
    .where(eq(userRoseUsage.userId, userId));

  const balance = Number(row?.roseBalance ?? 0);
  const usedToday = Number(row?.effectiveDailyUsed ?? 0);

  return {
    tier,
    dailyAllowance,
    usedToday,
    remainingToday: Math.max(0, dailyAllowance - usedToday),
    balance,
  };
}

/**
 * Adds roses to the purchased balance (creating the row on first grant).
 * @param {string} userId
 * @param {number} roses
 * @param {any} [tx] drizzle db or transaction
 */
export async function grantRoses(userId, roses, tx = db) {
  if (!(roses > 0)) return;
  await tx
    .insert(userRoseUsage)
    .values({
      userId,
      roseBalance: roses,
      dailyUsed: 0,
      dailyResetDate: sql`CURRENT_DATE`,
    })
    .onDuplicateKeyUpdate({
      set: { roseBalance: sql`${userRoseUsage.roseBalance} + ${roses}` },
    });
}

/**
 * Adds boosts to the balance (creating the row on first grant).
 * @param {string} userId
 * @param {number} boosts
 * @param {any} [tx] drizzle db or transaction
 */
export async function grantBoosts(userId, boosts, tx = db) {
  if (!(boosts > 0)) return;
  await tx
    .insert(userBoostUsage)
    .values({ userId, boostBalance: boosts })
    .onDuplicateKeyUpdate({
      set: { boostBalance: sql`${userBoostUsage.boostBalance} + ${boosts}` },
    });
}

/**
 * Purchased boosts the user hasn't used yet.
 * @param {string} userId
 */
export async function getBoostStatus(userId) {
  const [row] = await db
    .select({ boostBalance: userBoostUsage.boostBalance })
    .from(userBoostUsage)
    .where(eq(userBoostUsage.userId, userId));
  return { balance: Number(row?.boostBalance ?? 0) };
}

/**
 * Atomically spends one rose: draws from today's free tier allowance first, then
 * falls back to the purchased balance. Returns spent:false if both are exhausted.
 * @param {string} userId
 */
export async function spendRose(userId) {
  const { features } = await getEntitlements(userId);
  // Daily roses reset at UTC midnight; purchased balance never expires.
  const dailyAllowance = features.dailyRoses;

  return db.transaction(async (tx) => {
    await tx
      .insert(userRoseUsage)
      .values({
        userId,
        roseBalance: 0,
        dailyUsed: 0,
        dailyResetDate: sql`CURRENT_DATE`,
      })
      .onDuplicateKeyUpdate({ set: { userId: sql`user_id` } });

    const [row] = await tx
      .select({
        roseBalance: userRoseUsage.roseBalance,
        effectiveDailyUsed:
          sql`IF(${userRoseUsage.dailyResetDate} = CURRENT_DATE, ${userRoseUsage.dailyUsed}, 0)`.mapWith(
            Number,
          ),
      })
      .from(userRoseUsage)
      .where(eq(userRoseUsage.userId, userId))
      .for("update");

    const usedToday = Number(row?.effectiveDailyUsed ?? 0);
    const balance = Number(row?.roseBalance ?? 0);

    if (usedToday < dailyAllowance) {
      // If daily_reset_date was stale this also resets the counter to 1 instead of incrementing it.
      await tx
        .update(userRoseUsage)
        .set({
          dailyUsed: sql`IF(${userRoseUsage.dailyResetDate} = CURRENT_DATE, ${userRoseUsage.dailyUsed} + 1, 1)`,
          dailyResetDate: sql`CURRENT_DATE`,
        })
        .where(eq(userRoseUsage.userId, userId));
      return {
        spent: true,
        source: "daily",
        remainingToday: dailyAllowance - usedToday - 1,
        balance,
      };
    }

    if (balance > 0) {
      await tx
        .update(userRoseUsage)
        .set({ roseBalance: sql`${userRoseUsage.roseBalance} - 1` })
        .where(eq(userRoseUsage.userId, userId));
      return {
        spent: true,
        source: "balance",
        remainingToday: 0,
        balance: balance - 1,
      };
    }

    return { spent: false, source: null, remainingToday: 0, balance: 0 };
  });
}
