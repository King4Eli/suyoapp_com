import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "../../db/client.js";
import {
  gnInterestsVariant,
  gnPromptsVariant,
  matches,
  users,
  usersInterests,
  usersPrompt,
} from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { getEntitlements } from "../../global/entitlements.js";
import ngeohash from "ngeohash";

// Fields safe to hand back about ANOTHER user (a match candidate). Deliberately
// excludes contact/account info (user_email, user_phonenumber(_meta), user_settings,
// user_signedup_device_stats, user_datecreated/last_accessed, geo_hash/lat/long) --
// `SELECT users.*`/`SELECT *` here used to leak all of that to any authenticated
// caller, including strangers who just supply a guessed/enumerated user_id.
const CANDIDATE_PROFILE_COLUMNS = [
  "user_id",
  "user_fullname",
  "user_image",
  "user_verified",
  "geo_meta",
  "user_bio_dob",
  "user_bio_about",
  "user_bio_height",
  "user_bio_gender",
  "user_bio_ethnicity",
  "user_bio_highesteducation",
  "user_bio_relationshipgoal",
  "user_bio_schoolattended",
  "user_bio_politicalview",
  "user_bio_hometown",
  "user_bio_language",
  "user_bio_company",
  "user_bio_jobrole",
  "user_bio_smoking",
  "user_bio_drinking",
  "user_bio_children",
  "user_bio_religion",
  "user_bio_haspet",
  "user_privacy_show_distance",
  "user_privacy_show_age",
  "user_privacy_incognito",
  "user_bio_social_links",
];

const toCamel = (s) => s.replace(/_([a-zA-Z])/g, (_, c) => c.toUpperCase());

// Selects the columns above from `users`, keyed by their original snake_case
// name (not Drizzle's camelCase JS names) so every post-processing block
// below (attachPrompts, the response-shaping forEach loops, etc.) can keep
// reading rows the same way it did from the raw mysql2 result.
const CANDIDATE_PROFILE_SELECT = Object.fromEntries(
  CANDIDATE_PROFILE_COLUMNS.map((col) => [col, users[toCamel(col)]]),
);

/**
 * Returns 9 geohash prefixes (center + 8 neighbors) sized to the search radius.
 * Stored hashes are full precision, so these prefixes must be queried with LIKE.
 * @param {number} lat
 * @param {number} lng
 * @param {number} distanceMiles
 * @returns {string[] | null}
 */
function getSearchHashes(lat, lng, distanceMiles) {
  if (
    !Number.isFinite(distanceMiles) ||
    distanceMiles === -99 ||
    distanceMiles > 100
  ) {
    return null;
  }

  const precision = distanceMiles <= 5 ? 4 : distanceMiles <= 25 ? 3 : 2;

  const center = ngeohash.encode(lat, lng, precision);

  return [center, ...ngeohash.neighbors(center)];
}

/**
 * Batch-fetches each user's selected prompts (answered questions) and attaches
 * them as `user_bio_prompt` on the matching row.
 * @param {any[]} rows
 */
async function attachPrompts(rows) {
  const userIds = rows.map((u) => u.user_id).filter(Boolean);
  if (userIds.length === 0) return;

  const promptRows = await db
    .select({
      user_id: usersPrompt.userId,
      id_ai: gnPromptsVariant.idAi,
      question: gnPromptsVariant.question,
      answer: usersPrompt.answer,
    })
    .from(usersPrompt)
    .innerJoin(
      gnPromptsVariant,
      eq(usersPrompt.promptsVariantRefId, gnPromptsVariant.idAi),
    )
    .where(
      and(inArray(usersPrompt.userId, userIds), eq(gnPromptsVariant.status, 1)),
    )
    .orderBy(asc(usersPrompt.dateCreated));

  /** @type {Record<string, any[]>} */
  const promptsByUser = {};
  for (const r of promptRows) {
    if (!promptsByUser[r.user_id]) promptsByUser[r.user_id] = [];
    promptsByUser[r.user_id].push({
      id_ai: r.id_ai,
      question: r.question,
      answer: r.answer,
    });
  }

  rows.forEach((u) => {
    u.user_bio_prompt = promptsByUser[u.user_id] ?? [];
  });
}

/**
 * Batch-fetches each user's selected interests, grouped by category, and
 * attaches them as `user_bio_interests` on the matching row.
 * @param {any[]} rows
 */
async function attachInterests(rows) {
  const userIds = rows.map((u) => u.user_id).filter(Boolean);
  if (userIds.length === 0) return;

  const interestRows = await db
    .select({
      user_id: usersInterests.userId,
      id_ai: gnInterestsVariant.idAi,
      category: gnInterestsVariant.category,
      interested_in: gnInterestsVariant.interestedIn,
    })
    .from(usersInterests)
    .innerJoin(
      gnInterestsVariant,
      eq(usersInterests.interestsVariantRefId, gnInterestsVariant.idAi),
    )
    .where(
      and(
        inArray(usersInterests.userId, userIds),
        eq(gnInterestsVariant.status, 1),
      ),
    )
    .orderBy(asc(gnInterestsVariant.category), asc(gnInterestsVariant.idAi));

  /** @type {Record<string, Record<string, any[]>>} */
  const groupedByUser = {};
  for (const r of interestRows) {
    const userGroups = (groupedByUser[r.user_id] ??= {});
    (userGroups[r.category] ??= []).push({
      id_ai: r.id_ai,
      interested_in: r.interested_in,
    });
  }

  rows.forEach((u) => {
    const userGroups = groupedByUser[u.user_id] ?? {};
    u.user_bio_interests = Object.keys(userGroups).map((category) => ({
      category,
      items: userGroups[category],
    }));
  });
}

/**
 * Parses each candidate's `user_bio_social_links` JSON and replaces it with a
 * viewer-appropriate version: viewers whose plan has viewSocialLinks get the real
 * url, everyone else gets just the platform name (locked) -- the url itself must
 * never reach them, since withholding it only in the UI would be trivial to bypass.
 * @param {any[]} rows
 * @param {boolean} canViewLinks
 */
function attachSocialLinks(rows, canViewLinks) {
  rows.forEach((u) => {
    /** @type {any[]} */
    let links;
    try {
      links = u.user_bio_social_links
        ? typeof u.user_bio_social_links === "string"
          ? JSON.parse(u.user_bio_social_links)
          : u.user_bio_social_links
        : [];
    } catch {
      links = [];
    }
    u.user_bio_social_links = (Array.isArray(links) ? links : []).map((link) =>
      canViewLinks
        ? { platform: link.platform, url: link.url }
        : { platform: link.platform, locked: true },
    );
  });
}

/**
 * @param {string} [getOnePersons_id2]
 */
export default async function getPeopleToMatch(getOnePersons_id2) {
  /** @type {any} */
  const response = {
    code: 404,
    message:
      "There are no people available right now. Update your search preference.",
  };

  try {
    const { features } = await getEntitlements(sessions.currentUserID);
    // Lifestyle filters (smoking, pets, ethnicity, ...) are a paid feature. They're
    // only applied when the plan includes them -- saved values stay in the profile,
    // so they come back if the user resubscribes, but never filter for free users.
    const paidFilter = (/** @type {any} */ condition) =>
      features.advancedFilters ? condition : undefined;

    // ── Single person lookup (getOnePersons_id2 mode) ──────────────────────
    if (getOnePersons_id2) {
      const rows = await db
        .select(CANDIDATE_PROFILE_SELECT)
        .from(users)
        .where(eq(users.userId, getOnePersons_id2));

      if (Array.isArray(rows) && rows.length > 0) {
        rows.forEach((u) => {
          u.user_image = JSON.parse(u.user_image ?? "[]");
          u.geo_meta = u.geo_meta ?? {};
          if (u.user_privacy_show_age === "0") delete u.user_bio_dob;
          delete u.user_privacy_show_distance;
          delete u.user_privacy_show_age;
          delete u.user_privacy_incognito;
        });
        await attachPrompts(rows);
        await attachInterests(rows);
        attachSocialLinks(rows, features.viewSocialLinks);
        response.code = 200;
        response.message = "ok";
        response.matchespeoples = rows;
      }
      return response;
    }

    // ── Step 1: fetch current user to build geohash cells ─────────────────
    const [currentUser] = await db
      .select({
        user_id: users.userId,
        geo_latd: users.geoLatd,
        geo_long: users.geoLong,
        user_preference_distance: users.userPreferenceDistance,
      })
      .from(users)
      .where(eq(users.userId, sessions.currentUserID));

    if (!currentUser) {
      response.code = 401;
      response.message = "User not found.";
      return response;
    }

    const prefDist = Number(currentUser.user_preference_distance);
    const hasDistanceLimit =
      Number.isFinite(prefDist) && prefDist !== -99 && prefDist <= 100;
    const searchHashes = getSearchHashes(
      currentUser.geo_latd,
      currentUser.geo_long,
      prefDist,
    );

    // ── Step 2: main match query ───────────────────────────────────────────
    const m1 = alias(matches, "m1");
    const m2 = alias(matches, "m2");
    const currentUserAlias = alias(users, "currentUser");

    const distanceExpr = sql`(3959 * ACOS(
          LEAST(1, GREATEST(-1,
            SIN(RADIANS(${users.geoLatd})) * SIN(RADIANS(${currentUserAlias.geoLatd})) +
            COS(RADIANS(${users.geoLatd})) * COS(RADIANS(${currentUserAlias.geoLatd})) *
            COS(RADIANS(${users.geoLong} - ${currentUserAlias.geoLong}))
          ))
        ))`;

    const geoHashCondition = searchHashes
      ? or(...searchHashes.map((hash) => like(users.geoHash, `${hash}%`)))
      : undefined;

    const distanceCondition = hasDistanceLimit
      ? sql`${distanceExpr} <= ${currentUserAlias.userPreferenceDistance}`
      : undefined;

    const rows = await db
      .select({
        ...CANDIDATE_PROFILE_SELECT,
        match_status: m1.matchStatus,
        match_id: m1.matchId,
        distance_miles: distanceExpr,
      })
      .from(users)
      .leftJoin(
        m1,
        and(
          eq(m1.matchUserIdFrom, users.userId),
          eq(m1.matchUserIdTo, sessions.currentUserID),
          inArray(m1.matchStatus, ["0", "5"]),
        ),
      )
      .leftJoin(
        m2,
        or(
          and(
            eq(m2.matchUserIdTo, users.userId),
            eq(m2.matchUserIdFrom, sessions.currentUserID),
          ),
          and(
            eq(m2.matchUserIdFrom, users.userId),
            eq(m2.matchUserIdTo, sessions.currentUserID),
            inArray(m2.matchStatus, ["1", "2", "3"]),
          ),
        ),
      )
      .leftJoin(
        currentUserAlias,
        eq(currentUserAlias.userId, sessions.currentUserID),
      )
      .where(
        and(
          eq(users.userActive, "1"),
          ne(users.userId, sessions.currentUserID),
          geoHashCondition,
          isNull(m2.matchId),
          or(eq(users.userPrivacyIncognito, "0"), isNotNull(m1.matchId)),
          sql`(FLOOR(DATEDIFF(CURRENT_DATE, STR_TO_DATE(${users.userBioDob}, '%Y%m%d')) / 365))
              BETWEEN ${currentUserAlias.userPreferenceMinimumAge} AND ${currentUserAlias.userPreferenceMaximumAge}`,
          or(
            eq(currentUserAlias.userPreferenceGender, -99),
            eq(users.userBioGender, currentUserAlias.userPreferenceGender),
          ),
          paidFilter(
            or(
              eq(currentUserAlias.userPreferenceSmoking, "-99"),
              eq(users.userBioSmoking, currentUserAlias.userPreferenceSmoking),
            ),
          ),
          paidFilter(
            or(
              eq(currentUserAlias.userPreferencePet, "-99"),
              eq(users.userBioHaspet, currentUserAlias.userPreferencePet),
            ),
          ),
          paidFilter(
            or(
              eq(currentUserAlias.userPreferenceEthnicity, -99),
              eq(
                users.userBioEthnicity,
                currentUserAlias.userPreferenceEthnicity,
              ),
            ),
          ),
          paidFilter(
            or(
              eq(currentUserAlias.userPreferenceChildren, "-99"),
              eq(
                users.userBioChildren,
                currentUserAlias.userPreferenceChildren,
              ),
            ),
          ),
          or(
            eq(currentUserAlias.userPreferenceRelationshipgoal, -99),
            eq(
              users.userBioRelationshipgoal,
              currentUserAlias.userPreferenceRelationshipgoal,
            ),
          ),
          paidFilter(
            or(
              eq(currentUserAlias.userPreferenceDrinking, "-99"),
              eq(
                users.userBioDrinking,
                currentUserAlias.userPreferenceDrinking,
              ),
            ),
          ),
          paidFilter(
            or(
              eq(currentUserAlias.userPreferenceReligion, -99),
              eq(
                users.userBioReligion,
                currentUserAlias.userPreferenceReligion,
              ),
            ),
          ),
          paidFilter(
            or(
              eq(currentUserAlias.userPreferencePoliticalview, -99),
              eq(
                users.userBioPoliticalview,
                currentUserAlias.userPreferencePoliticalview,
              ),
            ),
          ),
          paidFilter(
            or(
              eq(currentUserAlias.userPreferenceHighesteducation, -99),
              eq(
                users.userBioHighesteducation,
                currentUserAlias.userPreferenceHighesteducation,
              ),
            ),
          ),
          distanceCondition,
        ),
      )
      .limit(9);

    if (Array.isArray(rows) && rows.length > 0) {
      rows.forEach((u) => {
        u.user_verified = Number(u.user_verified);
        u.user_image = JSON.parse(u.user_image ?? "[]");
        u.user_location = u.geo_meta ?? {};
        delete u.match_status;
        if (u.user_privacy_show_age === "0") delete u.user_bio_dob;
        if (u.user_privacy_show_distance === "0") delete u.distance_miles;
        delete u.user_privacy_show_distance;
        delete u.user_privacy_show_age;
        delete u.user_privacy_incognito;
      });
      await attachPrompts(rows);
      await attachInterests(rows);
      attachSocialLinks(rows, features.viewSocialLinks);
      response.code = 200;
      response.message = "ok";
      response.matchespeoples = rows;
    }
  } catch (err) {
    // @ts-ignore
    tools.serverLog(`Error in getPeopleToMatch: ${err}`, "getPeopleToMatch-0");
    response.code = 500;
    response.message = "Database error.";
  }

  return response;
}
