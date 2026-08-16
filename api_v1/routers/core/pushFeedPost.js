import db_pool from "../../global/database.js";
import { namer, tools, envInt } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { checkRateLimit } from "../../global/rateLimit.js";

// Configurable via .env, same pattern as entitlements.js's FREE_LIKE_DAILY_LIMIT -- keeps the
// daily post cap tunable without a code change/deploy.
const FEED_POST_DAILY_LIMIT = envInt("FEED_POST_DAILY_LIMIT", 10);
const FEED_POST_DAILY_WINDOW_SECONDS = envInt(
  "FEED_POST_DAILY_WINDOW_SECONDS",
  24 * 60 * 60,
);

const ALLOWED_MEDIA_TYPES = new Set(["image", "video"]);
const MAX_POST_MEDIA = 5;

/**
 * @param {{ caption?: string; media?: { type: string; p: string; w?: number; h?: number }[] }} data
 */
export default async function pushFeedPost(data) {
  /** @type {any} */
  const response = {
    code: 400,
    message: "Error creating post.",
  };

  try {
    const caption =
      typeof data?.caption === "string" ? data.caption.trim() : "";
    const media = Array.isArray(data?.media)
      ? data.media
          .filter(
            (m) =>
              m &&
              ALLOWED_MEDIA_TYPES.has(m.type) &&
              typeof m.p === "string" &&
              m.p,
          )
          .map((m) => {
            /** @type {any} */
            const entry = { type: m.type, p: m.p };
            if (
              Number.isFinite(m.w) &&
              Number.isFinite(m.h) &&
              m.w > 0 &&
              m.h > 0
            ) {
              entry.w = m.w;
              entry.h = m.h;
            }
            return entry;
          })
          .slice(0, MAX_POST_MEDIA)
      : [];

    if (!caption && media.length === 0) {
      response.code = 400;
      response.message = "Post needs a caption or media.";
      return response;
    }

    const limitCheck = await checkRateLimit(
      `${namer.ratelimit.feed_post_daily}${sessions.currentUserID}`,
      FEED_POST_DAILY_LIMIT,
      FEED_POST_DAILY_WINDOW_SECONDS,
    );
    if (!limitCheck.allowed) {
      response.code = 429;
      response.message =
        "You've reached today's posting limit. Try again tomorrow.";
      response.retryAfterSeconds = limitCheck.retryAfterSeconds;
      return response;
    }

    const postId = tools.generateAlphanumeric(21, 30);
    const sql = `
      INSERT INTO feed_posts (post_id, post_user_id, post_caption, post_media)
      VALUES (?, ?, ?, ?)
    `;
    /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
    const [result] = await db_pool.query(sql, [
      postId,
      sessions.currentUserID,
      caption || null,
      media.length > 0 ? JSON.stringify(media) : null,
    ]);

    if (result.affectedRows > 0) {
      response.code = 200;
      response.message = "Posted!";
      response.postId = postId;
      response.postsRemainingToday = Math.max(
        0,
        FEED_POST_DAILY_LIMIT - limitCheck.count,
      );
    }
  } catch (err) {
    tools.serverLog(`Error in pushFeedPost: ${err}`, "pushFeedPost-1");
    response.code = 500;
    response.message = "There has been an unrecognized error.";
  }

  return response;
}
