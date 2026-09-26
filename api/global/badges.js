import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { redisDo } from "./redisClient.js";
import { namer } from "./namer.js";
import { tools } from "./functions.js";

// Bottom-tab badge counts (Likes, Chats), pushed to the user's socket room when
// they change instead of the app refetching whole lists.
//
// The tab shows the exact number up to 9 and "9+" beyond, so counts are capped at
// BADGE_CAP (10 = "9+") -- the queries stop after 10 rows, and once a count is
// past 9 further changes aren't sent at all, since the badge wouldn't change.
export const BADGE_CAP = 10;

/**
 * @param {string} userId
 * @returns {Promise<{ likes: number; chats: number }>}
 */
export async function countBadges(userId) {
  // Likes: people waiting on this user's answer (same as getLikes).
  const [likeRows] = await db.execute(sql`
    SELECT COUNT(*) AS n FROM (
      SELECT 1 FROM matches m
      INNER JOIN users u ON u.user_id = m.match_user_id_from
      WHERE m.match_user_id_to = ${userId}
        AND m.match_status IN ('0', '5')
        AND u.user_active = '1'
      LIMIT ${BADGE_CAP}
    ) t`);
  // Chats: matches whose latest message is from the other person and unread
  // (same rule as getChatLists' last_message_read).
  const [chatRows] = await db.execute(sql`
    SELECT COUNT(*) AS n FROM (
      SELECT 1 FROM matches m
      INNER JOIN conversations c
        ON c.convo_id = m.last_message_id AND c.convo_match_id = m.match_id
      WHERE m.match_status = '1'
        AND (m.match_user_id_from = ${userId} OR m.match_user_id_to = ${userId})
        AND c.convo_status = '0'
        AND NOT (
          (c.convo_by_initiator = '1' AND m.match_user_id_from = ${userId}) OR
          (c.convo_by_initiator = '0' AND m.match_user_id_to = ${userId})
        )
      LIMIT ${BADGE_CAP}
    ) t`);
  return {
    // @ts-ignore
    likes: Number(likeRows?.[0]?.n ?? 0),
    // @ts-ignore
    chats: Number(chatRows?.[0]?.n ?? 0),
  };
}

/**
 * Recounts and sends "badge-counts" to each user whose (capped) counts changed
 * since the last push. Best-effort: never fails the action that triggered it.
 * @param {import("socket.io").Server | undefined} io
 * @param {...(string | null | undefined)} userIds
 */
export async function pushBadgeCounts(io, ...userIds) {
  if (!io) return;
  const unique = [...new Set(userIds.filter(Boolean))];
  await Promise.all(
    unique.map(async (userId) => {
      try {
        const counts = await countBadges(/** @type {string} */ (userId));
        const value = `${counts.likes},${counts.chats}`;
        const key = `${namer.redis.badgesLast}${userId}`;
        // GETSET-style: only emit when what the tab would show changed.
        const previous = await redisDo((client) =>
          client.set(key, value, { GET: true, EX: 24 * 60 * 60 }),
        );
        if (previous === value) return;
        io.to(`user-${userId}`).emit("badge-counts", counts);
      } catch (err) {
        tools.serverLog(
          `pushBadgeCounts failed for ${userId}: ${err}`,
          "badges-1",
        );
      }
    }),
  );
}

/**
 * Forgets the last pushed value so the next change is always sent -- used when the
 * app fetches counts itself (it might have missed pushes while offline).
 * @param {string} userId
 * @param {{ likes: number; chats: number }} counts
 */
export async function rememberBadgeCounts(userId, counts) {
  try {
    await redisDo((client) =>
      client.set(
        `${namer.redis.badgesLast}${userId}`,
        `${counts.likes},${counts.chats}`,
        { EX: 24 * 60 * 60 },
      ),
    );
  } catch {
    // Worst case the next push is sent even if unchanged -- harmless.
  }
}
