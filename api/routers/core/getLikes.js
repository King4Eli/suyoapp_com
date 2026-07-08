import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { matches, users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

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
        ),
      )
      .orderBy(
        desc(sql`${matches.matchStatus} = '5'`),
        desc(matches.matchDateAdded),
      );

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
    response.likedlist = likedList;
  } catch (err) {
    tools.serverLog(`Error in getLikes: ${err}`, "getLikes-100");
    response.code = 500;
    response.message = "Database error.";
  }
  return response;
}
