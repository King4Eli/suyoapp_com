import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { userBoostUsage, users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import {
  BOOST_MINUTES,
  WEEKLY_BOOST_DAYS,
  getBoostStatus,
  getEntitlements,
} from "../../global/entitlements.js";

/**
 * Starts a boost: the user's profile ranks first in discovery for BOOST_MINUTES
 * (getPeopleToMatch orders by users.user_boosted_until). Uses the plan's free
 * weekly boost when it's available, otherwise one purchased boost. One boost
 * runs at a time -- starting another while one is active is refused rather
 * than spending a second one.
 */
export default async function pushBoost() {
  /** @type {any} */
  const response = { code: 400, message: "Unable to start your boost." };
  const userId = sessions.currentUserID;
  try {
    const { features } = await getEntitlements(userId);

    const result = await db.transaction(async (tx) => {
      await tx
        .insert(userBoostUsage)
        .values({ userId, boostBalance: 0 })
        .onDuplicateKeyUpdate({ set: { userId: sql`user_id` } });

      // Locks both rows, so a double tap can't start two boosts or spend twice.
      const [usage] = await tx
        .select({
          balance: userBoostUsage.boostBalance,
          weeklyAvailable:
            sql`(${userBoostUsage.weeklyBoostUsedAt} IS NULL OR ${userBoostUsage.weeklyBoostUsedAt} <= NOW() - INTERVAL ${WEEKLY_BOOST_DAYS} DAY)`.mapWith(
              Number,
            ),
        })
        .from(userBoostUsage)
        .where(eq(userBoostUsage.userId, userId))
        .for("update");
      const [user] = await tx
        .select({
          active:
            sql`(${users.userBoostedUntil} IS NOT NULL AND ${users.userBoostedUntil} > NOW())`.mapWith(
              Number,
            ),
        })
        .from(users)
        .where(eq(users.userId, userId))
        .for("update");

      if (user?.active) return "active";

      if (features.weeklyBoost && usage?.weeklyAvailable) {
        await tx
          .update(userBoostUsage)
          .set({ weeklyBoostUsedAt: sql`NOW()` })
          .where(eq(userBoostUsage.userId, userId));
      } else if (Number(usage?.balance ?? 0) > 0) {
        await tx
          .update(userBoostUsage)
          .set({ boostBalance: sql`${userBoostUsage.boostBalance} - 1` })
          .where(eq(userBoostUsage.userId, userId));
      } else {
        return "none";
      }

      await tx
        .update(users)
        .set({
          userBoostedUntil: sql`NOW() + INTERVAL ${BOOST_MINUTES} MINUTE`,
        })
        .where(eq(users.userId, userId));
      return "started";
    });

    response.boosts = await getBoostStatus(userId, features.weeklyBoost);
    if (result === "active") {
      response.code = 409;
      response.message = "Your boost is already running.";
    } else if (result === "none") {
      response.code = 402;
      response.reason = "no_boosts";
      response.message = "You're out of boosts.";
    } else {
      response.code = 200;
      response.message = `You're boosted for ${BOOST_MINUTES} minutes!`;
    }
  } catch (err) {
    tools.serverLog(`Error in pushBoost: ${err}`, "pushBoost-0");
    response.code = 500;
    response.message = "Unable to start your boost. Please try again.";
  }
  return response;
}
