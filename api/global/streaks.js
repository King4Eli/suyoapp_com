import { redisDo } from "./redisClient.js";
import { envInt, tools } from "./functions.js";
import { namer } from "./namer.js";

// Daily activity streak, kept entirely in Redis.
// - A day counts once the user takes any action on the Peoples screen
//   (like, superlike, pass, block, report) -- see pushPeopleToMatch.js.
// - Days are UTC calendar days, same boundary as the daily rose allowance.
//   Acting on consecutive days extends the streak; skipping a whole day
//   breaks it (the key expires at the end of the day after the last action).
// - Reaching STREAK_DAYS adds one pending reward and the next day starts a
//   new cycle at 1. Pending rewards stack until claimed from the profile.
export const STREAK_DAYS = 7;
export const STREAK_REWARD = {
  roses: envInt("STREAK_REWARD_ROSES", 2),
  boosts: envInt("STREAK_REWARD_BOOSTS", 1),
};

// KEYS[1] streak hash {last: YYYY-MM-DD, count}, KEYS[2] pending reward counter
// ARGV today, yesterday, expire-at (unix), streak days
const RECORD_STREAK_SCRIPT = `
local last = redis.call('HGET', KEYS[1], 'last')
local count = tonumber(redis.call('HGET', KEYS[1], 'count') or '0')
if last == ARGV[1] then
  return {count, 0, 0}
end
if last == ARGV[2] and count < tonumber(ARGV[4]) then
  count = count + 1
else
  count = 1
end
redis.call('HSET', KEYS[1], 'last', ARGV[1], 'count', count)
redis.call('EXPIREAT', KEYS[1], ARGV[3])
local rewarded = 0
if count == tonumber(ARGV[4]) then
  redis.call('INCR', KEYS[2])
  rewarded = 1
end
return {count, 1, rewarded}
`;

/** @param {Date} date */
const utcDay = (date) => date.toISOString().slice(0, 10);

function dayWindow(now = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return {
    today: utcDay(now),
    yesterday: utcDay(new Date(startOfToday - dayMs)),
    // end of tomorrow -- missing all of tomorrow lets the streak lapse
    expireAt: Math.floor((startOfToday + 2 * dayMs) / 1000),
  };
}

/**
 * Counts today toward the user's streak. Best-effort: a Redis failure never
 * fails the action that triggered it.
 * @param {string} userId
 * @returns {Promise<{count: number, newDay: boolean, rewardEarned: boolean} | null>}
 */
export async function recordStreakActivity(userId) {
  if (!userId) return null;
  try {
    const { today, yesterday, expireAt } = dayWindow();
    /** @type {any} */
    const result = await redisDo((client) =>
      client.eval(RECORD_STREAK_SCRIPT, {
        keys: [
          `${namer.redis.streak}${userId}`,
          `${namer.redis.streakReward}${userId}`,
        ],
        arguments: [today, yesterday, String(expireAt), String(STREAK_DAYS)],
      }),
    );
    const [count, newDay, rewarded] = result.map(Number);
    return {
      count,
      newDay: newDay === 1,
      rewardEarned: rewarded === 1,
    };
  } catch (err) {
    tools.serverLog(
      `recordStreakActivity failed for ${userId}: ${err}`,
      "streak-1",
    );
    return null;
  }
}

/**
 * Current streak for display. count is 0 once the streak has lapsed.
 * @param {string} userId
 */
export async function getStreakStatus(userId) {
  const status = {
    count: 0,
    days: STREAK_DAYS,
    activeToday: false,
    rewardsPending: 0,
    reward: STREAK_REWARD,
  };
  try {
    const { today, yesterday } = dayWindow();
    const [streak, pending] = await redisDo((client) =>
      Promise.all([
        client.hGetAll(`${namer.redis.streak}${userId}`),
        client.get(`${namer.redis.streakReward}${userId}`),
      ]),
    );
    if (streak?.last === today || streak?.last === yesterday) {
      status.count = Number(streak.count ?? 0);
      status.activeToday = streak.last === today;
    }
    status.rewardsPending = Math.max(0, Number(pending ?? 0));
  } catch (err) {
    tools.serverLog(
      `getStreakStatus failed for ${userId}: ${err}`,
      "streak-2",
    );
  }
  return status;
}

/**
 * Atomically takes every pending streak reward so it can't be claimed twice.
 * @param {string} userId
 * @returns {Promise<number>} how many rewards were taken
 */
export async function takePendingStreakRewards(userId) {
  const raw = await redisDo((client) =>
    client.getDel(`${namer.redis.streakReward}${userId}`),
  );
  return Math.max(0, Number(raw ?? 0));
}

/**
 * Puts rewards back when granting them failed after they were taken.
 * @param {string} userId
 * @param {number} rewards
 */
export async function restorePendingStreakRewards(userId, rewards) {
  if (rewards <= 0) return;
  await redisDo((client) =>
    client.incrBy(`${namer.redis.streakReward}${userId}`, rewards),
  );
}
