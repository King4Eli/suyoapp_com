import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { conversations, matches, users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { hasFeature } from "../../global/entitlements.js";
import { sqlMilesTo } from "../../global/travelMode.js";

// How many locked teaser cards a plan without seeWhoLikedYou gets.
const LOCKED_PREVIEW_COUNT = 8;

export default async function getLikes() {
  /** @type { any } */
  const response = { code: 404, message: "No likes found." };

  try {
    // Distance is from the viewer's own location; skipped if it's unknown.
    const [viewer] = await db
      .select({ latd: users.geoLatd, long: users.geoLong })
      .from(users)
      .where(eq(users.userId, sessions.currentUserID));
    const viewerPoint =
      viewer &&
      Number.isFinite(Number(viewer.latd)) &&
      Number.isFinite(Number(viewer.long))
        ? { latd: Number(viewer.latd), long: Number(viewer.long) }
        : null;

    const rows = await db
      .select({
        match_id: matches.matchId,
        match_user_id_from: matches.matchUserIdFrom,
        match_dateAdded: matches.matchDateAdded,
        match_status: matches.matchStatus,
        user_image: users.userImage,
        user_fullname: users.userFullname,
        user_bio_dob: users.userBioDob,
        user_privacy_show_age: users.userPrivacyShowAge,
        user_verified: users.userVerified,
        user_privacy_show_distance: users.userPrivacyShowDistance,
        distance_miles: viewerPoint
          ? sql`${sqlMilesTo(users.geoLatd, users.geoLong, viewerPoint)}`.mapWith(
              Number,
            )
          : sql`NULL`,
        // A direct message (pushDirectMessage) is the only way a pending like has one.
        direct_message: conversations.convoMessage,
      })
      .from(matches)
      .innerJoin(users, eq(matches.matchUserIdFrom, users.userId))
      .leftJoin(conversations, eq(conversations.convoId, matches.lastMessageId))
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

    /**
     * @param {string | null} raw
     * @returns {{ text: string; on: "photo" | "about" | null } | null}
     */
    // "Show age" off: their date of birth never leaves the server
    // "Show distance" off: no distance either.
    for (const row of rows) {
      if (row.user_privacy_show_age === "0") row.user_bio_dob = null;
      if (row.user_privacy_show_distance === "0") row.distance_miles = null;
    }

    const parseDirectMessage = (raw) => {
      if (!raw) return null;
      try {
        const payload = JSON.parse(raw);
        if (payload?.t !== "text") return null;
        return { text: String(payload.str ?? ""), on: payload.ref?.k ?? null };
      } catch {
        return null;
      }
    };

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
          directMessage: null,
          directMessageOn: null,
          hasDirectMessage: Boolean(parseDirectMessage(row.direct_message)),
        }));
      return response;
    }

    const likedList = rows.map((row) => {
      const dm = parseDirectMessage(row.direct_message);
      return {
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
        directMessage: dm?.text ?? null,
        directMessageOn: dm?.on ?? null,
        hasDirectMessage: Boolean(dm),
        // miles (the app converts for display); null when unknown or hidden
        distanceMiles:
          row.distance_miles != null &&
          Number.isFinite(Number(row.distance_miles))
            ? Math.round(Number(row.distance_miles) * 10) / 10
            : null,
      };
    });
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
