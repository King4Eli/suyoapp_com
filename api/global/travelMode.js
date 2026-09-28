import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { usersLocations } from "../db/schema.js";
import { sqlHasFeature } from "./entitlements.js";

// Travel mode (VIP): besides their current location, a user can keep up to this
// many secondary locations. While travel mode is on and they're still VIP, they
// discover people near every one of those places and are discoverable there too.
export const MAX_SECONDARY_LOCATIONS = 2;

/**
 * SQL: whether a user's secondary locations currently count -- travel mode on AND
 * still entitled. Checked at query time rather than switched off when a subscription
 * ends, so a lapsed VIP drops out of other cities immediately.
 * @param {import("drizzle-orm").AnyColumn} travelModeColumn users.user_travel_mode
 * @param {import("drizzle-orm").AnyColumn} userIdColumn users.user_id
 */
export function sqlTravelModeActive(travelModeColumn, userIdColumn) {
  return and(
    eq(travelModeColumn, "1"),
    sqlHasFeature(userIdColumn, "travelMode"),
  );
}

/**
 * SQL: great-circle distance in miles (same haversine getPeopleToMatch has always
 * used), between a lat/long column pair and a fixed point.
 * @param {import("drizzle-orm").AnyColumn} latdColumn
 * @param {import("drizzle-orm").AnyColumn} longColumn
 * @param {{ latd: number; long: number }} point
 */
export function sqlMilesTo(latdColumn, longColumn, point) {
  return sql`(3959 * ACOS(
    LEAST(1, GREATEST(-1,
      SIN(RADIANS(${latdColumn})) * SIN(RADIANS(${point.latd})) +
      COS(RADIANS(${latdColumn})) * COS(RADIANS(${point.latd})) *
      COS(RADIANS(${longColumn} - ${point.long}))
    ))
  ))`;
}

/**
 * SQL: distance in miles from a lat/long column pair to the NEAREST of `points`.
 * (MySQL's LEAST needs at least two arguments, hence the single-point case.)
 * @param {import("drizzle-orm").AnyColumn} latdColumn
 * @param {import("drizzle-orm").AnyColumn} longColumn
 * @param {Array<{ latd: number; long: number }>} points
 */
export function sqlMilesToNearest(latdColumn, longColumn, points) {
  const distances = points.map((p) => sqlMilesTo(latdColumn, longColumn, p));
  return distances.length === 1
    ? distances[0]
    : sql`LEAST(${sql.join(distances, sql`, `)})`;
}

/**
 * @param {string} userId
 */
export async function getSecondaryLocations(userId) {
  return db
    .select({
      id: usersLocations.idAi,
      geo_meta: usersLocations.geoMeta,
      latd: usersLocations.geoLatd,
      long: usersLocations.geoLong,
    })
    .from(usersLocations)
    .where(eq(usersLocations.userId, userId))
    .orderBy(usersLocations.idAi);
}
