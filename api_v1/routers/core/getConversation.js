import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { getSubscriptionTier } from "../../global/entitlements.js";

/**
 * @param {string} matchId
 * @param {import("socket.io").Server} [io]
 */
export default async function getConversation(matchId, io) {
  matchId = matchId?.trim() || "ERRNAME";

  const sql = `SELECT
        m.match_id,
        m.match_status,
        m.match_dateAdded AS match_date,
        u.user_id AS other_user_id,
        u.user_fullname AS other_user_fullname,
        u.user_image AS other_user_image,
        u.geo_meta AS geo_meta,
        u.user_verified AS other_user_verified,
        c.convo_id,
        c.convo_message,
        c.convo_by_initiator,
        c.convo_status,
        c.convo_date_added,
        c.convo_date_updated,
        m.match_user_id_from,
        CASE
            WHEN m.match_user_id_from = ? THEN 1
            ELSE 0
        END AS is_from_me
    FROM matches m
    INNER JOIN users u ON (
        u.user_id = CASE
            WHEN m.match_user_id_from = ? THEN m.match_user_id_to
            ELSE m.match_user_id_from
        END
    )
    LEFT JOIN conversations c ON c.convo_match_id = m.match_id
        -- 0=unread, 1=read, -99=deleted -- deleted stays IN the thread (the row and its
        -- original convo_message are left untouched at rest by pushDeleteMessage.js; the
        -- loop below is what withholds the real content and reports it as deleted instead)
        -- so the other party sees a "message deleted" placeholder instead of a silent gap.
        AND c.convo_status IN ('0','1','-99')
    WHERE m.match_id = ?
        AND (m.match_user_id_from = ? OR m.match_user_id_to = ?)
    ORDER BY c.convo_date_added ASC;
    `;

  /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
  const [rows] = await db_pool.query(sql, [
    sessions.currentUserID, // for is_from_me CASE
    sessions.currentUserID, // for users JOIN CASE
    matchId, // for WHERE m.match_id
    sessions.currentUserID, // for WHERE user access check 1
    sessions.currentUserID, // for WHERE user access check 2
  ]);

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

    const [[viewerRow]] = await db_pool.query(
      `SELECT user_privacy_read_receipts FROM users WHERE user_id = ?`,
      [sessions.currentUserID],
    );
    if (viewerRow?.user_privacy_read_receipts === "1") {
      canSeeReadReceipts =
        (await getSubscriptionTier(sessions.currentUserID)) === "vip";
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
    const [updateResult] = await db_pool.query(
      `UPDATE conversations c
             INNER JOIN matches m ON m.match_id = c.convo_match_id
             SET c.convo_status = '1'
             WHERE c.convo_match_id = ?
               AND c.convo_status = '0'
               AND (
                 (m.match_user_id_from = ? AND c.convo_by_initiator = '0') OR
                 (m.match_user_id_from != ? AND c.convo_by_initiator = '1')
               )`,
      [matchId, sessions.currentUserID, sessions.currentUserID],
    );
    // @ts-ignore
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
