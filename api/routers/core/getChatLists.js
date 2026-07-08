import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "../../db/client.js";
import { conversations, matches, users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

export default async function getChatsListings() {
  const response = {
    code: 200,
    message: "ok",
    chatsListings: {
      withoutmessages: [],
      withmessages: [],
      countLikes: 0,
      imageLikes: null,
    },
  };

  const currentUserId = sessions.currentUserID;

  try {
    // 1. Optimized likes query - add index on (match_user_id_to, match_status)
    const likesResult = await db
      .select({ user_image: users.userImage })
      .from(matches)
      .leftJoin(users, eq(users.userId, matches.matchUserIdFrom))
      .where(
        and(
          eq(matches.matchUserIdTo, currentUserId),
          inArray(matches.matchStatus, ["0", "5"]),
        ),
      );

    response.chatsListings.countLikes = likesResult?.length || 0;
    if (likesResult?.[0]?.user_image) {
      try {
        const images = JSON.parse(likesResult[0].user_image);
        response.chatsListings.imageLikes = images?.[0] || null;
      } catch {
        response.chatsListings.imageLikes = null;
      }
    }

    // 2. Use matches.last_message_id as the source of truth for the latest message.
    const otherUser = alias(users, "other_user");
    const latest = alias(conversations, "latest");

    const matchesResult = await db
      .select({
        match_id: matches.matchId,
        match_status: matches.matchStatus,
        match_dateAdded: matches.matchDateAdded,
        match_user_id_from: matches.matchUserIdFrom,
        match_user_id_to: matches.matchUserIdTo,
        last_message_id: matches.lastMessageId,
        other_user_id: otherUser.userId,
        other_user_fullname: otherUser.userFullname,
        other_user_image: otherUser.userImage,
        other_user_verified: otherUser.userVerified,
        other_user_dob: otherUser.userBioDob,
        convo_id: latest.convoId,
        convo_message: latest.convoMessage,
        convo_date_added: latest.convoDateAdded,
        convo_by_initiator: latest.convoByInitiator,
        convo_status: latest.convoStatus,
        last_message_from_me: sql`CASE
            WHEN ${latest.convoByInitiator} = '1' AND ${matches.matchUserIdFrom} = ${currentUserId} THEN 1
            WHEN ${latest.convoByInitiator} = '0' AND ${matches.matchUserIdTo} = ${currentUserId} THEN 1
            ELSE 0
          END`,
      })
      .from(matches)
      .innerJoin(
        otherUser,
        eq(
          otherUser.userId,
          sql`CASE WHEN ${matches.matchUserIdFrom} = ${currentUserId} THEN ${matches.matchUserIdTo} ELSE ${matches.matchUserIdFrom} END`,
        ),
      )
      .leftJoin(
        latest,
        and(
          eq(latest.convoId, matches.lastMessageId),
          eq(latest.convoMatchId, matches.matchId),
          // Include deleted (-99) so a chat whose last message was deleted still shows
          // up with a "message deleted" preview instead of reverting to "no messages".
          inArray(latest.convoStatus, ["0", "1", "-99"]),
        ),
      )
      .where(
        and(
          eq(matches.matchStatus, "1"),
          or(
            eq(matches.matchUserIdFrom, currentUserId),
            eq(matches.matchUserIdTo, currentUserId),
          ),
        ),
      )
      .orderBy(
        desc(
          sql`COALESCE(${latest.convoDateAdded}, ${matches.matchDateAdded})`,
        ),
      );

    // Process matches without JSON.parse in loop where possible
    for (const row of matchesResult) {
      /** @type any */
      const matchData = {
        match_id: row.match_id,
        chat_with_user_id: row.other_user_id,
        user_fullname: row.other_user_fullname || "",
        user_dob: row.other_user_dob || null,
        user_verified: Number(row.other_user_verified) === 1,
        match_date: row.match_dateAdded,
        last_message_id: row.last_message_id || null,
        user_image: null,
      };

      // Parse user image once
      if (row.other_user_image) {
        try {
          const userImage = JSON.parse(row.other_user_image);
          matchData.user_image = userImage.length > 0 ? userImage[0] : null;
        } catch (error) {
          tools.serverLog(
            `Error parsing user image for match_id ${row.match_id}: ${error}`,
            "getChatsListings-300",
          );
        }
      }

      // Check if match has messages
      if (row.convo_id && row.convo_message) {
        try {
          // pushDeleteMessage.js only flips convo_status -- the original
          // convo_message is still sitting there at rest. Withhold it here,
          // same as getConversation.js does for the full thread.
          const lastMessage =
            row.convo_status === "-99"
              ? { t: "deleted" }
              : JSON.parse(row.convo_message);

          matchData.user_lastmessage = lastMessage;
          matchData.user_lastmessage_date = row.convo_date_added;
          matchData.convo_from_me = Boolean(row.last_message_from_me);

          // Message read status logic
          if (!matchData.convo_from_me && Number(row.convo_status) === 0) {
            matchData.last_message_read = false;
          } else {
            matchData.last_message_read = true;
          }

          // @ts-ignore
          response.chatsListings.withmessages.push(matchData);
        } catch (error) {
          tools.serverLog(
            `Error parsing last message for match_id ${row.match_id}: ${error}`,
            "getChatsListings-100",
          );
          // @ts-ignore
          response.chatsListings.withoutmessages.push(matchData);
        }
      } else {
        // @ts-ignore
        response.chatsListings.withoutmessages.push(matchData);
      }
    }

    return response;
  } catch (error) {
    tools.serverLog(
      `Error in getChatsListings: ${error}`,
      "getChatsListings-200",
    );
    response.code = 500;
    response.message = "Internal server error";
    return response;
  }
}
