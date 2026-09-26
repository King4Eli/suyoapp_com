import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { conversations, matches } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * Deletes a message "for everyone" -- only the original sender may do this.
 * Status-flip only -- the original convo_message is left untouched at rest.
 * getConversation.js/getChatLists.js are what withhold the real content from
 * API responses once a row is flagged deleted; nothing here rewrites it.
 * @param {string} convoId
 * @param {import("socket.io").Server} [io]
 */
export default async function pushDeleteMessage(convoId, io) {
  const response = { code: 404, message: "Message not found or no access." };
  convoId = convoId?.trim();
  if (!convoId || !sessions.currentUserID) {
    return response;
  }

  try {
    const rows = await db
      .select({
        convo_match_id: conversations.convoMatchId,
        convo_by_initiator: conversations.convoByInitiator,
        match_user_id_from: matches.matchUserIdFrom,
        match_user_id_to: matches.matchUserIdTo,
      })
      .from(conversations)
      .innerJoin(matches, eq(matches.matchId, conversations.convoMatchId))
      .where(
        and(
          eq(conversations.convoId, convoId),
          inArray(conversations.convoStatus, ["0", "1"]),
        ),
      );
    const row = rows?.[0];
    if (!row) {
      return response;
    }

    const isSender =
      (row.match_user_id_from === sessions.currentUserID &&
        row.convo_by_initiator === "1") ||
      (row.match_user_id_from !== sessions.currentUserID &&
        row.convo_by_initiator === "0");
    if (!isSender) {
      response.code = 403;
      response.message = "You can only delete your own messages.";
      return response;
    }

    const [result] = await db
      .update(conversations)
      .set({ convoStatus: "-99" })
      .where(eq(conversations.convoId, convoId));

    if (result.affectedRows > 0) {
      if (io) {
        // Also the recipient's user room, so their Chat tab badge updates even
        // when they aren't inside this conversation. One emit to both rooms
        // reaches each socket once.
        const otherUserId =
          row.match_user_id_from === sessions.currentUserID
            ? row.match_user_id_to
            : row.match_user_id_from;
        io.to([
          `match-${row.convo_match_id}`,
          `user-${otherUserId}`,
        ]).emit("message-deleted", {
          matchId: row.convo_match_id,
          convoId,
        });
      }
      response.code = 200;
      response.message = "Message deleted.";
    }
  } catch (err) {
    tools.serverLog(
      `Error in pushDeleteMessage: ${err}`,
      "pushDeleteMessage-0",
    );
    response.code = 500;
    // @ts-ignore
    response.message = err?.message || "Unable to delete message.";
  }

  return response;
}
