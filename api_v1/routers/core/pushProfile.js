import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
/**
 * @param {string | number} val
 */
function onlyNumber(val) {
  return val !== null &&
    val !== undefined &&
    String(val).trim() !== "" &&
    !isNaN(Number(val));
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
 try{
  if (!sessions.currentUserID) {
    return { code: 401, message: "Unauthorized request." };
  }
  const profUpdates = [];
  // Parse JSON fields
  for (const key of ["prof_prompts", "prof_interests", "prof_images_meta", "prof_location", "pref_languages", "pref_language"]) {
    if (input[key] && typeof input[key] === "string") {
      try {
        input[key] = JSON.parse(input[key]);
      }
      catch { }
    }
  }
  // Map input to DB fields
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
    if ((numeric ? onlyNumber(val) : val !== undefined && val !== null)) {
      const formattedVal = dbField === "user_location" && typeof val === "object"
        ? JSON.stringify(val)
        : val;
      profUpdates.push({ field: dbField, value: formattedVal });
    }
  }
  if (hasKey(input, "prof_images_meta")) {
    const incomingImages = Array.isArray(input.prof_images_meta) ? input.prof_images_meta : [];
    const normalizedImages = incomingImages
      .filter((img) => img && typeof img === "object")
      .map((img, idx) => {
        const path = img?.p ?? img?.uri ?? img?.url ?? "";
        if (!path) return null;
        const imageOrder = onlyNumber(img?.o) ? Number(img.o)
          : (onlyNumber(img?.i) ? Number(img.i)
            : (onlyNumber(img?.index) ? Number(img.index) : idx));
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
    profUpdates.push({ field: "user_image", value: JSON.stringify(normalizedImages) });
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
    const normalizedPrefLanguage = (typeof prefLanguageInput === "object")
      ? JSON.stringify(prefLanguageInput)
      : String(prefLanguageInput);
    profUpdates.push({ field: "user_preference_language", value: normalizedPrefLanguage });
  }

  // Privacy toggles
  if (hasKey(input, "prof_privacy") && input.prof_privacy && typeof input.prof_privacy === "object") {
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
  }

  let savedSomething = false;

  // Execute update
  if (profUpdates.length > 0) {
    const latestByField = new Map();
    for (const update of profUpdates) {
      latestByField.set(update.field, update.value);
    }
    // @ts-ignore
    const updates = [...latestByField.entries()].map(([field, value]) => ({ field, value }));
    const setClauses = updates.map(u => `\`${u.field}\` = ?`).join(", ");
    const values = updates.map(u => u.value);
    values.push(sessions.currentUserID);
    /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
    const [result] = await db_pool.query(`UPDATE users SET ${setClauses} WHERE user_id = ?`, values);
    if (result.affectedRows > 0) {
      savedSomething = true;
    }
  }

  // Prompts: user_id + prompts_variant_ref_id + answer, keyed to the prompt catalog (prompts_variant)
  if (hasKey(input, "prof_prompts") && Array.isArray(input.prof_prompts)) {
    const promptRows = input.prof_prompts
      .filter((/** @type {any} */ p) => p && onlyNumber(p.id_ai) && typeof p.answer === "string" && p.answer.trim())
      .map((/** @type {any} */ p) => [sessions.currentUserID, Number(p.id_ai), p.answer.trim()]);

    await db_pool.query("DELETE FROM users_prompt WHERE user_id = ?", [sessions.currentUserID]);
    if (promptRows.length > 0) {
      await db_pool.query("INSERT INTO users_prompt (user_id, prompts_variant_ref_id, answer) VALUES ?", [promptRows]);
    }
    savedSomething = true;
  }

  // Interests: user_id + interests_variant_ref_id, keyed to the interest catalog (interests_variant)
  if (hasKey(input, "prof_interests") && Array.isArray(input.prof_interests)) {
    const interestIds = input.prof_interests.filter(onlyNumber).map(Number);

    await db_pool.query("DELETE FROM users_interests WHERE user_id = ?", [sessions.currentUserID]);
    if (interestIds.length > 0) {
      const interestRows = interestIds.map((id) => [sessions.currentUserID, id]);
      await db_pool.query("INSERT INTO users_interests (user_id, interests_variant_ref_id) VALUES ?", [interestRows]);
    }
    savedSomething = true;
  }

  if (savedSomething) {
    response.code = 200;
    response.message = "Profile updated successfully.";
  } else {
    response.code = 203;
    response.message = "No changes made to your profile.";
  }
}catch(e){
  // @ts-ignore
    tools.serverLog(e?.message,"pushProfile-0")
  }
  return response;
}
