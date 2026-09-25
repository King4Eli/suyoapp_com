import { and, eq, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { matches } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { getConversationStarters as generateStarters } from "../../global/conversationStarters.js";

/**
 * Opening-message ideas for an empty chat (global/conversationStarters.js).
 * Only for the caller's own active match with no messages yet -- once someone
 * has said something, starters aren't needed.
 * @param {{ matchId?: string }} data
 */
export default async function getConversationStarters(data) {
  /** @type {any} */
  const response = { code: 200, message: "ok", starters: [] };
  try {
    const me = sessions.currentUserID;
    const matchId = String(data?.matchId ?? "").trim();
    const [match] = await db
      .select({
        status: matches.matchStatus,
        from: matches.matchUserIdFrom,
        to: matches.matchUserIdTo,
        lastMessageId: matches.lastMessageId,
      })
      .from(matches)
      .where(
        and(
          eq(matches.matchId, matchId),
          or(eq(matches.matchUserIdFrom, me), eq(matches.matchUserIdTo, me)),
        ),
      )
      .limit(1);
    if (!match || match.status !== "1") {
      response.code = 404;
      response.message = "Match not found.";
      return response;
    }
    if (match.lastMessageId) {
      response.reason = "has_messages";
      return response;
    }
    const otherId = match.from === me ? match.to : match.from;
    const result = await generateStarters(matchId, me, otherId);
    response.starters = result.starters;
    response.source = result.source;
  } catch (err) {
    tools.serverLog(
      `Error in getConversationStarters: ${err}`,
      "getConversationStarters-1",
    );
    response.code = 500;
    response.message = "Couldn't load ideas.";
  }
  return response;
}
