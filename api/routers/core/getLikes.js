import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { matches, users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { hasFeature } from "../../global/entitlements.js";

// How many locked teaser cards a plan without seeWhoLikedYou gets.
const LOCKED_PREVIEW_COUNT = 8;

export default async function getLikes() {
  /** @type { any } */
  const response = { code: 404, message: "No likes found." };

  try {
    const rows = await db
      .select({
        match_id: matches.matchId,
        match_user_id_from: matches.matchUserIdFrom,
        match_dateAdded: matches.matchDateAdded,
        match_status: matches.matchStatus,
        user_image: users.userImage,
        user_fullname: users.userFullname,
        user_bio_dob: users.userBioDob,
        user_verified: users.userVerified,
      })
      .from(matches)
      .innerJoin(users, eq(matches.matchUserIdFrom, users.userId))
      .where(
        and(
          eq(matches.matchUserIdTo, sessions.currentUserID),
          inArray(matches.matchStatus, ["0", "5"]),
          // hide likes from deleted/suspended accounts
          eq(users.userActive, "1"),
        ),
      )
      .orderBy(
        desc(sql`${matches.matchStatus} = '5'`),
        desc(matches.matchDateAdded),
      );

    const canSeeLikes = await hasFeature(
      sessions.currentUserID,
      "seeWhoLikedYou",
    );
    if (!canSeeLikes) {
      // Without the feature the client gets only anonymous teaser cards: no id,
      // match id, name or photo ever leaves the server, so a blurred UI can't be
      // bypassed by reading the response.
      response.code = 200;
      response.message = "ok";
      response.locked = true;
      response.likesTotal = rows.length;
      response.likedlist = rows
        .slice(0, LOCKED_PREVIEW_COUNT)
        .map((row, idx) => ({
          likedUserId: null,
          likedUserDate: row.match_dateAdded,
          likedUserImages: null,
          likedUserFullname: "",
          likedUserDob: row.user_bio_dob,
          likedMatchedId: `locked-${idx}`,
          match_status: Number(row.match_status ?? 0),
          is_superlike: Number(row.match_status ?? 0) === 5,
          verified: Number(row.user_verified ?? 0) === 1,
        }));
      return response;
    }

    const likedList = rows.map((row) => ({
      likedUserId: row.match_user_id_from,
      likedUserDate: row.match_dateAdded,
      likedUserImages: row.user_image
        ? (JSON.parse(row.user_image)[0] ?? "")
        : "",
      likedUserFullname: row.user_fullname,
      likedUserDob: row.user_bio_dob,
      likedMatchedId: row.match_id,
      match_status: Number(row.match_status ?? 0),
      is_superlike: Number(row.match_status ?? 0) === 5,
      verified: Number(row.user_verified ?? 0) === 1,
    }));
    response.code = 200;
    response.message = "ok";
    response.locked = false;
    response.likesTotal = likedList.length;
    response.likedlist = likedList;
  } catch (err) {
    tools.serverLog(`Error in getLikes: ${err}`, "getLikes-100");
    response.code = 500;
    response.message = "Database error.";
  }
  return response;
}
