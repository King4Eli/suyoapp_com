import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { namer } from "./namer.js";
import { redisDo } from "./redisClient.js";
import { tools } from "./functions.js";

// How stale users.user_last_accessed may get for an active user. Discovery ranks
// recently active people higher (getPeopleToMatch.js), so it has to reflect app
// use -- but writing it on every request would be a users-table write per call.
const TOUCH_EVERY_SECONDS = 10 * 60;

/**
 * Records that `userId` is using the app: bumps users.user_last_accessed at most
 * once per TOUCH_EVERY_SECONDS (a Redis SET NX marker gates the write).
 * Fire-and-forget; never throws.
 * @param {string | null | undefined} userId
 */
export function touchLastActive(userId) {
  if (!userId) return;
  (async () => {
    const first = await redisDo((client) =>
      client.set(`${namer.redis.lastActive}${userId}`, "1", {
        NX: true,
        EX: TOUCH_EVERY_SECONDS,
      }),
    );
    if (first !== "OK") return;
    await db
      .update(users)
      .set({ userLastAccessed: sql`NOW()` })
      .where(eq(users.userId, userId));
  })().catch((err) =>
    tools.serverLog(`touchLastActive failed: ${err}`, "activity-0"),
  );
}
