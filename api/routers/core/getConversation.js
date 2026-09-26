import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { conversations, matches, users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { hasFeature } from "../../global/entitlements.js";

/**
 * @param {string} matchId
 * @param {import("socket.io").Server} [io]
 */
export default async function getConversation(matchId, io) {
  matchId = matchId?.trim() || "ERRNAME";

  const rows = await db
    .select({
      match_id: matches.matchId,
      match_status: matches.matchStatus,
      match_date: matches.matchDateAdded,
      other_user_id: users.userId,
      other_user_fullname: users.userFullname,
      other_user_image: users.userImage,
      geo_meta: users.geoMeta,
      other_user_verified: users.userVerified,
      convo_id: conversations.convoId,
      convo_message: conversations.convoMessage,
      convo_by_initiator: conversations.convoByInitiator,
      convo_status: conversations.convoStatus,
      convo_date_added: conversations.convoDateAdded,
      convo_date_updated: conversations.convoDateUpdated,
      match_user_id_from: matches.matchUserIdFrom,
      is_from_me: sql`CASE WHEN ${matches.matchUserIdFrom} = ${sessions.currentUserID} THEN 1 ELSE 0 END`,
    })
    .from(matches)
    .innerJoin(
      users,
      eq(
        users.userId,
        sql`CASE WHEN ${matches.matchUserIdFrom} = ${sessions.currentUserID} THEN ${matches.matchUserIdTo} ELSE ${matches.matchUserIdFrom} END`,
      ),
    )
    .leftJoin(
      conversations,
      and(
        eq(conversations.convoMatchId, matches.matchId),
        // 0=unread, 1=read, -99=deleted -- deleted stays IN the thread (the row and its
        // original convo_message are left untouched at rest by pushDeleteMessage.js; the
        // loop below is what withholds the real content and reports it as deleted instead)
        // so the other party sees a "message deleted" placeholder instead of a silent gap.
        inArray(conversations.convoStatus, ["0", "1", "-99"]),
      ),
    )
    .where(
      and(
        eq(matches.matchId, matchId),
        or(
          eq(matches.matchUserIdFrom, sessions.currentUserID),
          eq(matches.matchUserIdTo, sessions.currentUserID),
        ),
      ),
    )
    .orderBy(asc(conversations.convoDateAdded));

  /** @type { any } */
  const response = {
    code: 200,
    message: "No conversation found.",
    chatsMessageListings: [],
    u2deets: null,
    convostarter: [],
  };

  // If no rows returned, either match doesn't exist or user doesn't have access
  if (!Array.isArray(rows) || rows.length === 0) {
    response.code = 404;
    response.message = "Match not found or no access";
    return response;
  }

  const messages = [];
  let user2Details = null;
  /** @type {string[]} */
  const randomConvoStarter = [];
  let fromMe;
  // Whether the viewer gets to see "did they read the messages I sent" -- gated on
  // the viewer's own VIP status and their own read-receipts setting only (not the
  // other party's setting; this is a single-sided "I get to see" feature, not a
  // mutual WhatsApp-style handshake).
  let canSeeReadReceipts = false;

  // Get user details from the first row (will exist even if no conversations)
  if (rows[0]) {
    const row = rows[0];
    try {
      const userImage = row.other_user_image
        ? JSON.parse(row.other_user_image)
        : [];
      const geo_meta = row.geo_meta ?? {};

      user2Details = {
        fullname: row.other_user_fullname || "",
        image: userImage.length > 0 ? userImage[0] : null,
        verified: Boolean(row.other_user_verified),
        uid: row.other_user_id || "",
        city: geo_meta?.city || null,
      };
    } catch (error) {
      tools.serverLog(
        `Error parsing user data for match_id ${row.match_id}: ${error}`,
        "getConversation-100",
      );
      user2Details = {
        fullname: row.other_user_fullname || "",
        image: null,
        verified: false,
        uid: row.other_user_id || "",
        city: null,
      };
    }

    const [viewerRow] = await db
      .select({ user_privacy_read_receipts: users.userPrivacyReadReceipts })
      .from(users)
      .where(eq(users.userId, sessions.currentUserID));
    if (viewerRow?.user_privacy_read_receipts === "1") {
      canSeeReadReceipts = await hasFeature(
        sessions.currentUserID,
        "readReceipts",
      );
    }
  }

  // Process conversations (if any)
  for (const row of rows) {
    // Skip rows where convo_id is null (these are from the LEFT JOIN when no conversations)
    if (!row.convo_id) {
      continue;
    }

    try {
      const isDeleted = row.convo_status === "-99";
      // pushDeleteMessage.js never touches the stored row -- deletion is a status
      // flip only, so the original convo_message is still sitting there. Withhold
      // it here at the API boundary instead: never send real content for a deleted
      // message, regardless of what's actually in the database.
      const convo = isDeleted
        ? { t: "deleted" }
        : row.convo_message
          ? JSON.parse(row.convo_message)
          : {};
      if (convo?.t) {
        fromMe =
          (row.match_user_id_from === sessions.currentUserID &&
            Number(row.convo_by_initiator) === 1) ||
          (row.match_user_id_from !== sessions.currentUserID &&
            Number(row.convo_by_initiator) === 0);
        messages.push({
          messageId: row.convo_id,
          fromMe,
          type: convo.t,
          message: isDeleted ? null : (convo.str ?? null),
          src: isDeleted ? null : (convo.src ?? null),
          dateAdded: row.convo_date_added ?? null,
          // Only meaningful (and only sent) for messages the viewer sent -- whether
          // the viewer read something they received is never ambiguous to them.
          read:
            fromMe && canSeeReadReceipts ? row.convo_status === "1" : undefined,
        });
      }
    } catch (error) {
      tools.serverLog(
        `Error parsing conversation message for convo_id ${row.convo_id}: ${error}`,
        "getConversation-200",
      );
    }
  }

  // Mark every unread message NOT sent by the viewer as read -- covers the whole
  // backlog, not just the latest message, so earlier messages don't stay stuck
  // "unread" forever once the viewer has actually seen the conversation.
  try {
    // rows[0].match_user_id_from is already known (fetched above), so the
    // original "JOIN matches to compare match_user_id_from" collapses into a
    // plain JS branch instead of a multi-table UPDATE (Drizzle's MySQL update
    // builder doesn't support joins).
    const viewerIsInitiator =
      rows[0]?.match_user_id_from === sessions.currentUserID;
    const [updateResult] = await db
      .update(conversations)
      .set({ convoStatus: "1" })
      .where(
        and(
          eq(conversations.convoMatchId, matchId),
          eq(conversations.convoStatus, "0"),
          eq(conversations.convoByInitiator, viewerIsInitiator ? "0" : "1"),
        ),
      );
    if (updateResult?.affectedRows > 0 && io) {
      // Thin "something changed" ping, no read-status payload -- the sender's
      // next getConversation() call re-derives `read` under the same privacy
      // gate above, so this can't leak receipt data to someone not entitled to it.
      // readByUserId matters: both participants' sockets are in this room (each
      // joins on opening the conversation), so without it the READER's own client
      // would also receive this and could mistake it for "MY sent messages just
      // got read", flipping their own outgoing messages to read=true regardless
      // of the other side's actual read state.
      io.to(`match-${matchId}`).emit("messages-read", {
        matchId,
        readByUserId: sessions.currentUserID,
      });
    }
  } catch (error) {
    tools.serverLog(
      `Error updating message status for match_id ${matchId}: ${error}`,
      "getConversation-300",
    );
  }

  response.code = 200;
  response.message = messages.length > 0 ? "ok" : "No messages yet";
  response.u2deets = user2Details;
  response.chatsMessageListings = messages;
  response.convostarter = randomConvoStarter;

  return response;
}
