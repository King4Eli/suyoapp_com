import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users, usersInterests, usersPrompt } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { getSubscriptionTier } from "../../global/entitlements.js";
// Platforms the client offers a field for. Keep in sync with ProfileEdit.tsx's SOCIAL_PLATFORMS.
const ALLOWED_SOCIAL_PLATFORMS = ["instagram", "snapchat", "tiktok", "twitter"];

/**
 * Validates+normalizes the user's social links input into a safe {platform, url}[]
 * (one entry per platform max, http/https only) or null if there's nothing valid to save.
 * @param {any} rawLinks
 */
function normalizeSocialLinks(rawLinks) {
  if (!Array.isArray(rawLinks)) return [];
  const seenPlatforms = new Set();
  const normalized = [];
  for (const entry of rawLinks) {
    const platform = String(entry?.platform ?? "")
      .trim()
      .toLowerCase();
    const url = String(entry?.url ?? "").trim();
    if (
      !ALLOWED_SOCIAL_PLATFORMS.includes(platform) ||
      seenPlatforms.has(platform)
    )
      continue;
    if (!url) continue;
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      continue;
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:")
      continue;
    seenPlatforms.add(platform);
    normalized.push({ platform, url: parsedUrl.toString() });
  }
  return normalized;
}

/**
 * @param {string | number} val
 */
function onlyNumber(val) {
  return (
    val !== null &&
    val !== undefined &&
    String(val).trim() !== "" &&
    !isNaN(Number(val))
  );
}
/**
 * @param {Record<string, any>} input
 * @param {string} key
 */
function hasKey(input, key) {
  return !!input && Object.prototype.hasOwnProperty.call(input, key);
}
/**
 * @param {{ [x: string]: any;   }} input
 */
export default async function pushProfile(input = {}) {
  const response = { code: 404, message: "Error saving your profile." };
  try {
    if (!sessions.currentUserID) {
      return { code: 401, message: "Unauthorized request." };
    }
    const profUpdates = [];
    // Parse JSON fields
    for (const key of [
      "prof_prompts",
      "prof_interests",
      "prof_social_links",
      "prof_images_meta",
      "prof_location",
      "pref_languages",
      "pref_language",
    ]) {
      if (input[key] && typeof input[key] === "string") {
        try {
          input[key] = JSON.parse(input[key]);
        } catch {}
      }
    }
    // Map input to DB fields. These are raw column names (not Drizzle's
    // camelCase JS names) because the SET clause below is built dynamically
    // via sql.raw() -- the set of columns touched varies per request, which
    // Drizzle's typed .set({...}) object can't express.
    const fieldMapping = [
      ["prof_gender", "user_bio_gender", true],
      ["prof_about", "user_bio_about"],
      ["prof_height", "user_bio_height", true],
      ["prof_smoking", "user_bio_smoking", true],
      ["prof_drinking", "user_bio_drinking", true],
      ["prof_relationshipgoal", "user_bio_relationshipgoal", true],
      ["prof_pet", "user_bio_haspet"],
      ["prof_ethnicity", "user_bio_ethnicity", true],
      ["prof_children", "user_bio_children", true],
      ["prof_religion", "user_bio_religion", true],
      ["prof_highesteducation", "user_bio_highesteducation", true],
      ["prof_hometown", "user_bio_hometown"],
      ["prof_languages", "user_bio_language"],
      ["prof_political", "user_bio_politicalview", true],
      ["prof_schoolattended", "user_bio_schoolattended"],
      ["prof_location", "user_location"],
      ["prof_company", "user_bio_company"],
      ["prof_jobrole", "user_bio_jobrole"],
    ];
    for (const [inputKey, dbField, numeric] of fieldMapping) {
      // @ts-ignore
      const val = input[inputKey];
      // @ts-ignore
      if (!hasKey(input, inputKey)) continue;
      if (numeric ? onlyNumber(val) : val !== undefined && val !== null) {
        const formattedVal =
          dbField === "user_location" && typeof val === "object"
            ? JSON.stringify(val)
            : val;
        profUpdates.push({ field: dbField, value: formattedVal });
      }
    }
    if (hasKey(input, "prof_images_meta")) {
      const incomingImages = Array.isArray(input.prof_images_meta)
        ? input.prof_images_meta
        : [];
      const normalizedImages = incomingImages
        .filter((img) => img && typeof img === "object")
        .map((img, idx) => {
          const path = img?.p ?? img?.uri ?? img?.url ?? "";
          if (!path) return null;
          const imageOrder = onlyNumber(img?.o)
            ? Number(img.o)
            : onlyNumber(img?.i)
              ? Number(img.i)
              : onlyNumber(img?.index)
                ? Number(img.index)
                : idx;
          return {
            p: path,
            w: onlyNumber(img?.w) ? Number(img.w) : null,
            h: onlyNumber(img?.h) ? Number(img.h) : null,
            _o: imageOrder,
          };
        })
        .filter(Boolean)
        // @ts-ignore
        .sort((a, b) => a._o - b._o)
        .map((img) => ({
          p: img?.p,
          w: img?.w,
          h: img?.h,
        }));
      profUpdates.push({
        field: "user_image",
        value: JSON.stringify(normalizedImages),
      });
    }
    // Preferences
    const prefMapping = [
      ["pref_gender", "user_preference_gender"],
      ["min_age", "user_preference_minimum_age"],
      ["max_age", "user_preference_maximum_age"],
      ["pref_distance", "user_preference_distance"],
      ["pref_smoking", "user_preference_smoking"],
      ["pref_drinking", "user_preference_drinking"],
      ["pref_relationshipgoal", "user_preference_relationshipgoal"],
      ["pref_pet", "user_preference_pet"],
      ["pref_ethnicity", "user_preference_ethnicity"],
      ["pref_children", "user_preference_children"],
      ["pref_religion", "user_preference_religion"],
      ["pref_politicalview", "user_preference_politicalview"],
      ["pref_highesteducation", "user_preference_highesteducation"],
      ["pref_min_height", "user_preference_height_minimum"],
      ["pref_max_height", "user_preference_height_maximum"],
    ];
    for (const [inputKey, dbField] of prefMapping) {
      const val = input[inputKey];
      if (onlyNumber(val)) {
        profUpdates.push({ field: dbField, value: val });
      }
    }
    const prefLanguageInput = hasKey(input, "pref_languages")
      ? input.pref_languages
      : input.pref_language;
    if (prefLanguageInput !== undefined && prefLanguageInput !== null) {
      const normalizedPrefLanguage =
        typeof prefLanguageInput === "object"
          ? JSON.stringify(prefLanguageInput)
          : String(prefLanguageInput);
      profUpdates.push({
        field: "user_preference_language",
        value: normalizedPrefLanguage,
      });
    }

    // Privacy toggles
    if (
      hasKey(input, "prof_privacy") &&
      input.prof_privacy &&
      typeof input.prof_privacy === "object"
    ) {
      const privacyMapping = [
        ["showDistance", "user_privacy_show_distance"],
        ["showAge", "user_privacy_show_age"],
        ["incognitoMode", "user_privacy_incognito"],
      ];
      for (const [inputKey, dbField] of privacyMapping) {
        const val = input.prof_privacy[inputKey];
        if (typeof val === "boolean") {
          profUpdates.push({ field: dbField, value: val ? "1" : "0" });
        }
      }

      // Read receipts is VIP-only. The client UI already hides this toggle from
      // non-VIP users, but that's not an authorization boundary -- anyone could
      // still hit this endpoint directly, so re-check the tier server-side
      // before honoring a request to turn it ON. Turning it off never needs the
      // tier check -- it's always allowed.
      const readReceiptsVal = input.prof_privacy["readReceipts"];
      if (typeof readReceiptsVal === "boolean") {
        const canTurnOn =
          readReceiptsVal &&
          (await getSubscriptionTier(sessions.currentUserID)) === "vip";
        profUpdates.push({
          field: "user_privacy_read_receipts",
          value: canTurnOn ? "1" : "0",
        });
      }
    }

    let savedSomething = false;

    // Execute update. Field set varies per request (only the keys the caller
    // actually sent), so this stays a dynamically-built SET clause via
    // sql.raw() for column identifiers -- fieldMapping/prefMapping/
    // privacyMapping above are a fixed, hardcoded list of column names (never
    // user input), so raw-interpolating the identifier is safe; values still
    // go through normal parameterized placeholders.
    if (profUpdates.length > 0) {
      const latestByField = new Map();
      for (const update of profUpdates) {
        latestByField.set(update.field, update.value);
      }
      const setClauses = [...latestByField.entries()].map(
        ([field, value]) => sql`${sql.raw(`\`${field}\``)} = ${value}`,
      );
      const [result] = await db.execute(
        sql`UPDATE users SET ${sql.join(setClauses, sql.raw(", "))} WHERE user_id = ${sessions.currentUserID}`,
      );
      if (result.affectedRows > 0) {
        savedSomething = true;
      }
    }

    // Prompts: user_id + prompts_variant_ref_id + answer, keyed to the prompt catalog (gn_prompts_variant)
    if (hasKey(input, "prof_prompts") && Array.isArray(input.prof_prompts)) {
      const promptRows = input.prof_prompts
        .filter(
          (/** @type {any} */ p) =>
            p &&
            onlyNumber(p.id_ai) &&
            typeof p.answer === "string" &&
            p.answer.trim(),
        )
        .map((/** @type {any} */ p) => ({
          userId: sessions.currentUserID,
          promptsVariantRefId: Number(p.id_ai),
          answer: p.answer.trim(),
        }));

      await db
        .delete(usersPrompt)
        .where(eq(usersPrompt.userId, sessions.currentUserID));
      if (promptRows.length > 0) {
        await db.insert(usersPrompt).values(promptRows);
      }
      savedSomething = true;
    }

    // Interests: user_id + interests_variant_ref_id, keyed to the interest catalog (gn_interests_variant)
    if (
      hasKey(input, "prof_interests") &&
      Array.isArray(input.prof_interests)
    ) {
      const interestIds = input.prof_interests.filter(onlyNumber).map(Number);

      await db
        .delete(usersInterests)
        .where(eq(usersInterests.userId, sessions.currentUserID));
      if (interestIds.length > 0) {
        const interestRows = interestIds.map((id) => ({
          userId: sessions.currentUserID,
          interestsVariantRefId: id,
        }));
        await db.insert(usersInterests).values(interestRows);
      }
      savedSomething = true;
    }

    // Social links: stored inline as JSON on the user row (small fixed platform set,
    // unlike interests/prompts which reference a growing catalog table).
    if (hasKey(input, "prof_social_links")) {
      const socialLinks = normalizeSocialLinks(input.prof_social_links);
      await db
        .update(users)
        .set({ userBioSocialLinks: JSON.stringify(socialLinks) })
        .where(eq(users.userId, sessions.currentUserID));
      savedSomething = true;
    }

    if (savedSomething) {
      response.code = 200;
      response.message = "Profile updated successfully.";
    } else {
      response.code = 203;
      response.message = "No changes made to your profile.";
    }
  } catch (e) {
    // @ts-ignore
    tools.serverLog(e?.message, "pushProfile-0");
  }
  return response;
}
