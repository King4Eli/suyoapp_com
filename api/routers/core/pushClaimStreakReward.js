import { db } from "../../db/client.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { grantDirectMessages, grantRoses } from "../../global/entitlements.js";
import {
  STREAK_REWARD,
  restorePendingStreakRewards,
  takePendingStreakRewards,
} from "../../global/streaks.js";

/**
 * Grants every pending 7-day streak reward (roses + direct messages) to the current
 * user. Rewards are taken from Redis atomically first, and put back if the
 * grant fails, so a reward is neither lost nor claimed twice.
 */
export default async function pushClaimStreakReward() {
  /** @type {any} */
  const response = { code: 404, message: "No streak reward to claim." };
  const userId = sessions.currentUserID;

  let rewards = 0;
  try {
    rewards = await takePendingStreakRewards(userId);
    if (rewards <= 0) return response;

    const granted = {
      roses: STREAK_REWARD.roses * rewards,
      directMessages: STREAK_REWARD.directMessages * rewards,
    };
    await db.transaction(async (tx) => {
      await grantRoses(userId, granted.roses, tx);
      await grantDirectMessages(userId, granted.directMessages, tx);
    });

    response.code = 200;
    response.message = "Streak reward claimed!";
    response.granted = granted;
  } catch (err) {
    tools.serverLog(
      `Error in pushClaimStreakReward: ${err}`,
      "pushClaimStreakReward-0",
    );
    await restorePendingStreakRewards(userId, rewards).catch((restoreErr) =>
      tools.serverLog(
        `Failed to restore ${rewards} streak rewards for ${userId}: ${restoreErr}`,
        "pushClaimStreakReward-1",
      ),
    );
    response.code = 500;
    response.message = "Unable to claim reward. Please try again.";
  }
  return response;
}
