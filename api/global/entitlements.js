import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  payments,
  productListVariant,
  productLists,
  subscriptions,
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

/**
 * 'free' | 'plus' | 'vip', derived from the caller's active subscription product name.
 * @param {string} userId
 */
export async function getSubscriptionTier(userId) {
  const subscription = await getActiveSubscription(userId);
  const tier = String(subscription?.product_name ?? "")
    .trim()
    .toLowerCase();
  return tier === "plus" || tier === "vip" ? tier : "free";
}

// Free-tier daily allowance of roses (spent on super likes); resets at UTC midnight.
export const ROSE_DAILY_ALLOWANCE = { free: 2, plus: 5, vip: 10 };

/**
 * Today's rose usage/allowance/balance snapshot for display purposes (does not spend anything).
 * `user_rose_usage` has one row per user; `daily_used` only counts if `daily_reset_date`
 * is today, since nothing proactively zeroes it out overnight.
 * @param {string} userId
 */
export async function getRoseStatus(userId) {
  const tier = await getSubscriptionTier(userId);
  const dailyAllowance =
    ROSE_DAILY_ALLOWANCE[tier] ?? ROSE_DAILY_ALLOWANCE.free;

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
 * Atomically spends one rose: draws from today's free tier allowance first, then
 * falls back to the purchased balance. Returns spent:false if both are exhausted.
 * @param {string} userId
 */
export async function spendRose(userId) {
  const tier = await getSubscriptionTier(userId);
  const dailyAllowance =
    ROSE_DAILY_ALLOWANCE[tier] ?? ROSE_DAILY_ALLOWANCE.free;

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
