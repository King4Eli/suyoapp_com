import db_pool from "./database.js";
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
  const subscriptionSql = `SELECT
      s.id AS subscription_id,
      s.variant_id_ref,
      s.start_date,
      s.end_date,
      s.external_platform,
      s.external_id,
      s.payment_id_ref,
      s.status,
      s.cancel_at_period_end,
      pv.name AS plan_name,
      pv.description AS plan_description,
      pv.price AS plan_price,
      pv.billing_cycle,
      pl.pl_sku,
      pl.pl_name AS product_name,
      pl.pl_description AS product_description,
      p.payment_id,
      p.status AS payment_status,
      p.p_amount AS payment_amount,
      p.p_currency AS payment_currency
    FROM subscriptions s
    LEFT JOIN product_list_variant pv
      ON s.variant_id_ref = pv.id_ai
    LEFT JOIN product_lists pl
      ON pv.product_lists_id_ref = pl.pl_sku
    LEFT JOIN payments p
      ON s.payment_id_ref = p.payment_id
    WHERE s.user_id = ?
      AND s.status = 1
      AND s.end_date > NOW()
    ORDER BY s.date_created DESC
    LIMIT 1`;

  /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
  const [subRows] = await db_pool.query(subscriptionSql, [userId]);

  if (!Array.isArray(subRows) || subRows.length === 0) {
    return null;
  }

  /** @type {any} */
  const subData = subRows[0];
  return {
    id: subData.subscription_id,
    variant_id: subData.variant_id_ref,
    plan_name: subData.plan_name,
    plan_description: subData.plan_description,
    plan_price: parseFloat(subData.plan_price),
    billing_cycle: subData.billing_cycle,
    product_name: subData.product_name,
    product_description: subData.product_description,
    platform: subData.external_platform,
    external_id: subData.external_id,
    payment_id: subData.payment_id,
    payment_status: subData.payment_status,
    payment_amount: parseFloat(subData.payment_amount),
    payment_currency: subData.payment_currency,
    start_date: subData.start_date,
    end_date: subData.end_date,
    status: "active",
    cancel_at_period_end: Boolean(subData.cancel_at_period_end),
    days_remaining: Math.max(
      0,
      Math.ceil(
        (new Date(subData.end_date)?.getTime() - new Date()?.getTime()) /
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

  /** @type {[any[], any]} */
  const [rows] = await db_pool.query(
    `SELECT rose_balance,
                IF(daily_reset_date = CURRENT_DATE, daily_used, 0) AS effective_daily_used
         FROM user_rose_usage WHERE user_id = ?`,
    [userId],
  );
  const row = rows?.[0];
  const balance = Number(row?.rose_balance ?? 0);
  const usedToday = Number(row?.effective_daily_used ?? 0);

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

  const connection = await db_pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO user_rose_usage (user_id, rose_balance, daily_used, daily_reset_date)
             VALUES (?, 0, 0, CURRENT_DATE)
             ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId],
    );
    /** @type {[any[], any]} */
    const [rows] = await connection.query(
      `SELECT rose_balance,
                    IF(daily_reset_date = CURRENT_DATE, daily_used, 0) AS effective_daily_used
             FROM user_rose_usage WHERE user_id = ? FOR UPDATE`,
      [userId],
    );
    const row = rows?.[0];
    const usedToday = Number(row?.effective_daily_used ?? 0);
    const balance = Number(row?.rose_balance ?? 0);

    if (usedToday < dailyAllowance) {
      // If daily_reset_date was stale this also resets the counter to 1 instead of incrementing it.
      await connection.query(
        `UPDATE user_rose_usage
                 SET daily_used = IF(daily_reset_date = CURRENT_DATE, daily_used + 1, 1),
                     daily_reset_date = CURRENT_DATE
                 WHERE user_id = ?`,
        [userId],
      );
      await connection.commit();
      return {
        spent: true,
        source: "daily",
        remainingToday: dailyAllowance - usedToday - 1,
        balance,
      };
    }

    if (balance > 0) {
      await connection.query(
        `UPDATE user_rose_usage SET rose_balance = rose_balance - 1 WHERE user_id = ?`,
        [userId],
      );
      await connection.commit();
      return {
        spent: true,
        source: "balance",
        remainingToday: 0,
        balance: balance - 1,
      };
    }

    await connection.rollback();
    return { spent: false, source: null, remainingToday: 0, balance: 0 };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
