import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { matches, users } from "../../db/schema.js";
import { namer, tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { checkRateLimit } from "../../global/rateLimit.js";
import {
  getEntitlements,
  spendRose,
  FREE_LIKE_DAILY_LIMIT,
  FREE_LIKE_WINDOW_SECONDS,
} from "../../global/entitlements.js";
import { recordStreakActivity } from "../../global/streaks.js";

/**
 * Tells the recipient's socket room about a new like/match so their app can toast it
 * immediately, without polling or reopening the screen. Best-effort: failures here must
 * never fail the underlying like/match write, which is why every error is swallowed.
 * @param {import("socket.io").Server | undefined} io
 * @param {string} recipientUserId
 * @param {'new-like' | 'new-match'} event
 * @param {Record<string, any>} extra
 */
async function notifyUser(io, recipientUserId, event, extra) {
  if (!io || !recipientUserId) return;
  try {
    const rows = await db
      .select({
        user_fullname: users.userFullname,
        user_image: users.userImage,
      })
      .from(users)
      .where(eq(users.userId, sessions.currentUserID))
      .limit(1);
    const actor = rows?.[0];
    if (!actor) return;

    let firstPhoto = null;
    try {
      const images = JSON.parse(actor.user_image ?? "[]");
      firstPhoto = images?.[0]?.p ?? null;
    } catch {}

    io.to(`user-${recipientUserId}`).emit(event, {
      fromUserId: sessions.currentUserID,
      fromUserName: actor.user_fullname,
      fromUserPhoto: firstPhoto,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  } catch (err) {
    tools.serverLog(
      `Error notifying user ${recipientUserId} of ${event}: ${err}`,
      "pushPeopleToMatch-2",
    );
  }
}

// match_status: 0=waiting(like),1=match,2=notinterested,3=block,4=reported,5=superlike
// What a caller may request. "1" is never requested directly -- a match only
// happens when the recipient of a like/superlike likes back.
const REQUESTABLE_STATUSES = ["0", "2", "3", "4", "5"];
const LIKE_STATUSES = ["0", "5"];
// Block/report are final: nothing either party sends can reopen them.
const FINAL_STATUSES = ["3", "4"];

/**
 * The existing match row between the caller and another user, found by id (must
 * include the caller) or by the user pair.
 * @param {string} matchId
 * @param {string} otherUserId
 */
async function findMatchRow(matchId, otherUserId) {
  const me = sessions.currentUserID;
  const byParticipant = or(
    eq(matches.matchUserIdFrom, me),
    eq(matches.matchUserIdTo, me),
  );
  const where = matchId
    ? and(eq(matches.matchId, matchId), byParticipant)
    : or(
        and(
          eq(matches.matchUserIdFrom, me),
          eq(matches.matchUserIdTo, otherUserId),
        ),
        and(
          eq(matches.matchUserIdFrom, otherUserId),
          eq(matches.matchUserIdTo, me),
        ),
      );
  const [row] = await db
    .select({
      matchId: matches.matchId,
      matchStatus: matches.matchStatus,
      matchUserIdFrom: matches.matchUserIdFrom,
      matchUserIdTo: matches.matchUserIdTo,
    })
    .from(matches)
    .where(where)
    .orderBy(desc(matches.matchDateAdded))
    .limit(1);
  return row ?? null;
}

/**
 * Resolves what an update of an existing match should become, or why it's refused.
 * @param {{ matchStatus: string; matchUserIdTo: string }} row
 * @param {string} requested
 * @returns {{ next: string } | { code: number; message: string }}
 */
function resolveTransition(row, requested) {
  const current = String(row.matchStatus);
  if (FINAL_STATUSES.includes(current)) {
    return { code: 409, message: "This match is no longer available." };
  }
  if (LIKE_STATUSES.includes(requested)) {
    // Liking back: only the person who received the like can complete the match,
    // and only while that like is still pending.
    const iAmRecipient =
      String(row.matchUserIdTo) === String(sessions.currentUserID);
    if (!iAmRecipient || !LIKE_STATUSES.includes(current)) {
      return { code: 409, message: "This match is no longer available." };
    }
    return { next: "1" };
  }
  // 2 (pass / unmatch), 3 (block), 4 (report) are always allowed from a live match.
  return { next: requested };
}

/**
 * @param {{ user_id2: any; match_status: any; matchId: any; }} data
 * @param {import("socket.io").Server} [io]
 */
export default async function pushPeopleToMatch(data, io) {
  /** @type { any } */
  const response = {
    code: 400,
    message: "Error processing match.",
  };
  try {
    const me = sessions.currentUserID ?? "";
    let secondUserId = data.user_id2?.toLowerCase() ?? "";
    const matchStatus =
      data.match_status != null ? String(data.match_status) : "0";

    if (!me || !REQUESTABLE_STATUSES.includes(matchStatus)) {
      response.message = "Invalid match action.";
      return response;
    }
    if (!data.matchId && (!secondUserId || secondUserId === me)) {
      response.message = "Missing user.";
      return response;
    }

    // Always act on the real row if one exists -- a client-supplied "new" action
    // on a pair that already has a match must not create a second, conflicting row.
    const existing = await findMatchRow(data.matchId ?? "", secondUserId);
    if (data.matchId && !existing) {
      response.code = 404;
      response.message = "Match not found or no access.";
      return response;
    }
    if (existing) {
      secondUserId =
        String(existing.matchUserIdFrom) === String(me)
          ? existing.matchUserIdTo
          : existing.matchUserIdFrom;
    }

    /** @type {string} */
    let nextStatus = matchStatus;
    if (existing) {
      const transition = resolveTransition(existing, matchStatus);
      if ("code" in transition) {
        response.code = transition.code;
        response.message = transition.message;
        return response;
      }
      nextStatus = transition.next;
    }

    // Plan limits are checked after the action is known to be valid, so a refused
    // action never burns a like or a rose.
    const { features } = await getEntitlements(me);
    if (matchStatus === "0" && !features.unlimitedLikes) {
      const limitCheck = await checkRateLimit(
        `${namer.ratelimit.likes_daily}${me}`,
        FREE_LIKE_DAILY_LIMIT,
        FREE_LIKE_WINDOW_SECONDS,
      );
      if (!limitCheck.allowed) {
        response.code = 429;
        response.message =
          "You've reached today's FREE limit.\nUpgrade to get unlimited likes and features.";
        response.retryAfterSeconds = limitCheck.retryAfterSeconds;
        response.likesRemainingToday = 0;
        return response;
      }
      response.likesRemainingToday = Math.max(
        0,
        FREE_LIKE_DAILY_LIMIT - limitCheck.count,
      );
    }

    if (matchStatus === "5") {
      const roseResult = await spendRose(me);
      if (!roseResult.spent) {
        response.code = 402;
        response.message =
          "You're out of roses. Buy more to keep sending super likes.";
        response.rosesRemainingToday = 0;
        return response;
      }
      response.rosesRemainingToday = roseResult.remainingToday;
      if (roseResult.source === "balance")
        response.roseBalance = roseResult.balance;
    }

    if (!existing) {
      const genChatId = tools.generateAlphanumeric(21, 30);
      const [result] = await db.insert(matches).values({
        matchId: genChatId,
        matchUserIdFrom: me,
        matchUserIdTo: secondUserId,
        matchStatus: nextStatus,
      });
      if (result.affectedRows > 0) {
        response.code = 200;
        response.matchId = genChatId;
        response.otherUserId = secondUserId;
        response.message = "Wait for them to match you back";
        if (LIKE_STATUSES.includes(nextStatus)) {
          notifyUser(io, secondUserId, "new-like", {
            matchId: genChatId,
            isSuperlike: nextStatus === "5",
          });
        }
      }
    } else {
      // Guard on the status we validated against, so a concurrent change (e.g. the
      // other person blocking at the same moment) isn't overwritten.
      const [result] = await db
        .update(matches)
        .set({ matchStatus: nextStatus })
        .where(
          and(
            eq(matches.matchId, existing.matchId),
            eq(matches.matchStatus, existing.matchStatus),
          ),
        );
      if (result.affectedRows === 0) {
        response.code = 409;
        response.message = "This match changed, please refresh.";
        return response;
      }
      const ifUsersMatched = nextStatus === "1";
      response.code = 200;
      response.matchId = existing.matchId;
      response.otherUserId = secondUserId;
      response.itisamatch = ifUsersMatched;
      response.message = ifUsersMatched
        ? "Hurray! you matched with someone."
        : "User blocked";
      // The current caller already sees "It's a match!" locally -- only the other
      // party (who liked first and has been waiting) needs a real-time nudge.
      if (ifUsersMatched) {
        notifyUser(io, secondUserId, "new-match", {
          matchId: existing.matchId,
        });
      }
    }
    // Any successful Peoples action counts today toward the 7-day streak.
    if (response.code === 200) {
      response.streak = await recordStreakActivity(me);
    }
  } catch (err) {
    tools.serverLog(
      `Error in pushPeopleToMatch: ${err}`,
      "pushPeopleToMatch-1",
    );
    response.code = 500;
    response.message = "There has been an unrecognized error.";
  }
  return response;
}
