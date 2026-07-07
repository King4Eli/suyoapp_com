import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";
import ngeohash from "ngeohash";

/**
 * Returns 9 geohash prefixes (center + 8 neighbors) sized to the search radius.
 * Stored hashes are full precision, so these prefixes must be queried with LIKE.
 * @param {number} lat
 * @param {number} lng
 * @param {number} distanceMiles
 * @returns {string[] | null}
 */
function getSearchHashes(lat, lng, distanceMiles) {
  if (!Number.isFinite(distanceMiles) || distanceMiles === -99 || distanceMiles > 100) {
    return null;
  }

  const precision =
    distanceMiles <= 5 ? 4 :
    distanceMiles <= 25 ? 3 :
    2;

  const center = ngeohash.encode(lat, lng, precision);

  return [center, ...ngeohash.neighbors(center)];
}

/**
 * @param {string} [getOnePersons_id2]
 */
export default async function getPeopleToMatch(getOnePersons_id2) {
  /** @type {any} */
  const response = {
    code: 404,
    message: "There are no people available right now. Update your search preference.",
  };

  try {
    // ── Single person lookup (getOnePersons_id2 mode) ──────────────────────
    if (getOnePersons_id2) {
      const sql = `SELECT * FROM users WHERE user_id = ?`;
      /** @type {[any[], any]} */
      const [rows] = await db_pool.query(sql, [getOnePersons_id2]);

      if (Array.isArray(rows) && rows.length > 0) {
        rows.forEach((u) => {
          u.user_image      = JSON.parse(u.user_image      ?? "[]");
          u.geo_meta        = (u.geo_meta ??  {} );
          u.user_bio_prompt = JSON.parse(u.user_bio_prompt ?? "{}");
        });
        response.code           = 200;
        response.message        = "ok";
        response.matchespeoples = rows;
      }
      return response;
    }

    // ── Step 1: fetch current user to build geohash cells ─────────────────
    // @ts-ignore
    const [[currentUser]] = await db_pool.query(
      `SELECT user_id, geo_latd, geo_long, user_preference_distance
       FROM users WHERE user_id = ?`,
      [sessions.currentUserID]
    );

    if (!currentUser) {
      response.code    = 401;
      response.message = "User not found.";
      return response;
    }

    const prefDist    = Number(currentUser.user_preference_distance);
    const hasDistanceLimit = Number.isFinite(prefDist) && prefDist !== -99 && prefDist <= 100;
    const searchHashes = getSearchHashes(
      currentUser.geo_latd,
      currentUser.geo_long,
      prefDist
    );
 
    const geoHashFilter = searchHashes
      ? `AND (${searchHashes.map(() => "users.geo_hash LIKE ?").join(" OR ")})`
      : "";
    const distanceFilter = hasDistanceLimit
      ? `AND (3959 * ACOS(
           LEAST(1, GREATEST(-1,
             SIN(RADIANS(users.geo_latd)) * SIN(RADIANS(currentUser.geo_latd)) +
             COS(RADIANS(users.geo_latd)) * COS(RADIANS(currentUser.geo_latd)) *
             COS(RADIANS(users.geo_long - currentUser.geo_long))
           ))
         )) <= currentUser.user_preference_distance`
      : "";
    // ── Step 2: main match query ───────────────────────────────────────────
    const sql = `
      SELECT users.*, m1.match_status, m1.match_id,
        (3959 * ACOS(
          LEAST(1, GREATEST(-1,
            SIN(RADIANS(users.geo_latd)) * SIN(RADIANS(currentUser.geo_latd)) +
            COS(RADIANS(users.geo_latd)) * COS(RADIANS(currentUser.geo_latd)) *
            COS(RADIANS(users.geo_long - currentUser.geo_long))
          ))
        )) AS distance_miles
      FROM users
      LEFT JOIN matches m1
        ON m1.match_user_id_from = users.user_id
       AND m1.match_user_id_to   = ?
       AND m1.match_status       = '0'
      LEFT JOIN matches m2
        ON (m2.match_user_id_to   = users.user_id AND m2.match_user_id_from = ?)
        OR (m2.match_user_id_from = users.user_id AND m2.match_user_id_to   = ? AND m2.match_status IN ('1','2','3'))
      LEFT JOIN users AS currentUser ON currentUser.user_id = ?
      WHERE users.user_active = '1'
        AND users.user_id    != ?
        ${geoHashFilter}
        AND m2.match_id IS NULL
        AND ((FLOOR(DATEDIFF(CURRENT_DATE, STR_TO_DATE(users.user_bio_dob, '%Y%m%d')) / 365))
              BETWEEN currentUser.user_preference_minimum_age AND currentUser.user_preference_maximum_age)
         AND (currentUser.user_preference_gender           = -99  OR users.user_bio_gender           = currentUser.user_preference_gender)
       AND (currentUser.user_preference_smoking          = '-99' OR users.user_bio_smoking          = currentUser.user_preference_smoking)
        AND (currentUser.user_preference_pet              = '-99' OR users.user_bio_haspet            = currentUser.user_preference_pet)
        AND (currentUser.user_preference_ethnicity        = -99  OR users.user_bio_ethnicity         = currentUser.user_preference_ethnicity)
         AND (currentUser.user_preference_bodytype         = -99  OR users.user_bio_bodytype          = currentUser.user_preference_bodytype)
        AND (currentUser.user_preference_children         = '-99' OR users.user_bio_children         = currentUser.user_preference_children)
        AND (currentUser.user_preference_relationshipgoal = -99  OR users.user_bio_relationshipgoal  = currentUser.user_preference_relationshipgoal)
        AND (currentUser.user_preference_drinking         = '-99' OR users.user_bio_drinking         = currentUser.user_preference_drinking)
        AND (currentUser.user_preference_religion         = -99  OR users.user_bio_religion          = currentUser.user_preference_religion)
        AND (currentUser.user_preference_highesteducation = -99  OR users.user_bio_highesteducation  = currentUser.user_preference_highesteducation)
        ${distanceFilter}
      LIMIT 9
    `;

    const params = [
      // 5 × currentUserID for the JOINs / WHERE
      sessions.currentUserID,
      sessions.currentUserID,
      sessions.currentUserID,
      sessions.currentUserID,
      sessions.currentUserID,
      // 9 geohash prefixes for LIKE 'prefix%'
      ...(searchHashes || []).map(hash => `${hash}%`),
    ];

    /** @type {[any[], any]} */
    const [rows] = await db_pool.query(sql, params);
 
    if (Array.isArray(rows) && rows.length > 0) {
      rows.forEach((u) => {
        u.user_verified   = Number(u.user_verified);
        u.user_image      = JSON.parse(u.user_image      ?? "[]");
        u.user_location   =  (u.geo_meta ??  {}) ;
        u.user_bio_prompt = JSON.parse(u.user_bio_prompt ?? "{}");
        delete u.match_status;
      });
      response.code           = 200;
      response.message        = "ok";
      response.matchespeoples = rows;
    }
  } catch (err) {
    // @ts-ignore
    tools.serverLog(`Error in getPeopleToMatch: ${err}`,"getPeopleToMatch-0");
    response.code    = 500;
    response.message = "Database error.";
  }

  return response;
}
