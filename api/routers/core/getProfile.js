import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  gnInterestsVariant,
  gnPromptsVariant,
  users,
  usersInterests,
  usersPrompt,
} from "../../db/schema.js";
import { namer, tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import {
  getActiveSubscription,
  getBoostStatus,
  getDirectMessageStatus,
  getEntitlements,
  getRoseStatus,
  FREE_LIKE_DAILY_LIMIT,
} from "../../global/entitlements.js";
import { peekRateLimit } from "../../global/rateLimit.js";
import { getStreakStatus } from "../../global/streaks.js";

export default async function getProfile() {
  /** @type { any } */
  const response = { code: 404, message: "Error getting your profile!" };

  try {
    // Fetch user profile with ALL fields from schema
    const userRows = await db
      .select({
        user_id: users.userId,
        user_fullname: users.userFullname,
        user_email: users.userEmail,
        user_bio_dob: users.userBioDob,
        user_phonenumber: users.userPhonenumber,
        user_phonenumber_meta: users.userPhonenumberMeta,
        user_image: users.userImage,
        user_active: users.userActive,
        geo_latd: users.geoLatd,
        geo_long: users.geoLong,
        geo_hash: users.geoHash,
        geo_meta: users.geoMeta,
        user_verified: users.userVerified,
        user_datecreated: users.userDatecreated,
        user_last_accessed: users.userLastAccessed,
        user_signedup_device_stats: users.userSignedupDeviceStats,
        user_bio_highesteducation: users.userBioHighesteducation,
        user_bio_relationshipgoal: users.userBioRelationshipgoal,
        user_bio_schoolattended: users.userBioSchoolattended,
        user_bio_politicalview: users.userBioPoliticalview,
        user_bio_hometown: users.userBioHometown,
        user_bio_language: users.userBioLanguage,
        user_bio_company: users.userBioCompany,
        user_bio_ethnicity: users.userBioEthnicity,
        user_bio_smoking: users.userBioSmoking,
        user_bio_drinking: users.userBioDrinking,
        user_bio_children: users.userBioChildren,
        user_bio_religion: users.userBioReligion,
        user_bio_jobrole: users.userBioJobrole,
        user_bio_gender: users.userBioGender,
        user_bio_haspet: users.userBioHaspet,
        user_bio_about: users.userBioAbout,
        user_bio_height: users.userBioHeight,
        user_preference_minimum_age: users.userPreferenceMinimumAge,
        user_preference_maximum_age: users.userPreferenceMaximumAge,
        user_preference_highesteducation: users.userPreferenceHighesteducation,
        user_preference_height_minimum: users.userPreferenceHeightMinimum,
        user_preference_height_maximum: users.userPreferenceHeightMaximum,
        user_preference_relationshipgoal: users.userPreferenceRelationshipgoal,
        user_preference_ethnicity: users.userPreferenceEthnicity,
        user_preference_smoking: users.userPreferenceSmoking,
        user_preference_distance: users.userPreferenceDistance,
        user_preference_drinking: users.userPreferenceDrinking,
        user_preference_children: users.userPreferenceChildren,
        user_preference_gender: users.userPreferenceGender,
        user_preference_pet: users.userPreferencePet,
        user_preference_religion: users.userPreferenceReligion,
        user_preference_politicalview: users.userPreferencePoliticalview,
        user_preference_language: users.userPreferenceLanguage,
        user_settings: users.userSettings,
        user_privacy_show_distance: users.userPrivacyShowDistance,
        user_privacy_show_age: users.userPrivacyShowAge,
        user_privacy_incognito: users.userPrivacyIncognito,
        user_privacy_read_receipts: users.userPrivacyReadReceipts,
        user_bio_social_links: users.userBioSocialLinks,
      })
      .from(users)
      .where(eq(users.userId, sessions.currentUserID))
      .limit(1);

    if (!Array.isArray(userRows) || userRows.length === 0) {
      return response;
    }

    const userProfile = userRows?.[0];

    // Fetch active subscription if exists
    const subscription = await getActiveSubscription(sessions.currentUserID);

    // Fetch user's selected prompts
    /** @type {  any[] } */
    let userPrompts = [];
    try {
      const promptsRows = await db
        .select({
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
          and(
            eq(usersPrompt.userId, sessions.currentUserID),
            eq(gnPromptsVariant.status, 1),
          ),
        )
        .orderBy(asc(usersPrompt.dateCreated));
      if (Array.isArray(promptsRows)) {
        userPrompts = promptsRows.map((row) => ({
          id_ai: Number(row.id_ai),
          question: String(row.question ?? ""),
          answer: String(row.answer ?? ""),
        }));
      }
    } catch (e) {
      tools.serverLog(`Error fetching user prompts: ${e}`, "getProfile-1");
      userPrompts = [];
    }

    // Fetch user's selected interests
    /** @type {  any[] } */
    let userInterests = [];
    try {
      const interestsRows = await db
        .select({
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
            eq(usersInterests.userId, sessions.currentUserID),
            eq(gnInterestsVariant.status, 1),
          ),
        )
        .orderBy(
          asc(gnInterestsVariant.category),
          asc(gnInterestsVariant.idAi),
        );
      if (Array.isArray(interestsRows)) {
        /** @type { Record<string, any[]> } */
        const grouped = {};
        for (const row of interestsRows) {
          const category = String(row.category ?? "Unknown");
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push({
            id_ai: Number(row.id_ai),
            interested_in: String(row.interested_in ?? ""),
          });
        }
        userInterests = Object.keys(grouped).map((category) => ({
          category,
          items: grouped[category],
        }));
      }
    } catch (e) {
      tools.serverLog(`Error fetching user interests: ${e}`, "getProfile-105");
      userInterests = [];
    }

    // Parse JSON fields with error handling
    let userImage = [];
    let userSettings = {};
    let userLocation = {};

    try {
      userImage = userProfile?.user_image
        ? JSON.parse(userProfile.user_image)
        : [];
    } catch (e) {
      tools.serverLog(
        `Error parsing user_image for user ${sessions.currentUserID}: ${e}`,
        "getProfile-102",
      );
      userImage = [];
    }

    try {
      userSettings = userProfile.user_settings
        ? JSON.parse(userProfile.user_settings)
        : {};
    } catch (e) {
      tools.serverLog(
        `Error parsing user_settings for user ${sessions.currentUserID}: ${e}`,
        "getProfile-103",
      );
      userSettings = {};
    }
    userLocation = userProfile.geo_meta ?? {};

    const [entitlements, roses, directMessages, boosts, streak] =
      await Promise.all([
        getEntitlements(sessions.currentUserID),
        getRoseStatus(sessions.currentUserID),
        getDirectMessageStatus(sessions.currentUserID),
        getBoostStatus(sessions.currentUserID),
        getStreakStatus(sessions.currentUserID),
      ]);
    let likesRemainingToday = null;
    if (!entitlements.features.unlimitedLikes) {
      const likesPeek = await peekRateLimit(
        `${namer.ratelimit.likes_daily}${sessions.currentUserID}`,
        FREE_LIKE_DAILY_LIMIT,
      );
      likesRemainingToday = likesPeek.remaining;
    }

    // Plans with freeRewind rewind at no cost (pushRewindMatch); others buy a
    // one-time rewind per match instead.
    const rewind = { freeForTier: entitlements.features.freeRewind };

    response.code = 200;
    response.message = "Profile retrieved successfully";
    response.currentUser = {
      // Basic Profile
      profile: {
        id: userProfile.user_id,
        fullname: userProfile.user_fullname,
        email: userProfile.user_email,
        dob: userProfile.user_bio_dob,
        phonenumber: userProfile.user_phonenumber,
        phonenumber_meta: userProfile.user_phonenumber_meta
          ? typeof userProfile.user_phonenumber_meta === "string"
            ? JSON.parse(userProfile.user_phonenumber_meta)
            : userProfile.user_phonenumber_meta
          : null,
        images: userImage,
        location: userLocation,
        settings: userSettings,
        privacy: {
          showDistance: userProfile.user_privacy_show_distance === "1",
          showAge: userProfile.user_privacy_show_age === "1",
          incognitoMode: userProfile.user_privacy_incognito === "1",
          readReceipts: userProfile.user_privacy_read_receipts === "1",
        },
        verified: userProfile.user_verified === "1",
      },

      // Bio Information
      bio: {
        about: userProfile.user_bio_about,
        dob: userProfile.user_bio_dob,
        height: userProfile.user_bio_height,
        gender: userProfile.user_bio_gender,
        ethnicity: userProfile.user_bio_ethnicity,
        education: userProfile.user_bio_highesteducation,
        relationshipgoal: userProfile.user_bio_relationshipgoal,
        school: userProfile.user_bio_schoolattended,
        politicalview: userProfile.user_bio_politicalview,
        hometown: userProfile.user_bio_hometown,
        language: userProfile.user_bio_language
          ? typeof userProfile.user_bio_language === "string"
            ? JSON.parse(userProfile.user_bio_language)
            : userProfile.user_bio_language
          : [],
        company: userProfile.user_bio_company,
        jobrole: userProfile.user_bio_jobrole,
        smoking: userProfile.user_bio_smoking,
        drinking: userProfile.user_bio_drinking,
        children: userProfile.user_bio_children,
        religion: userProfile.user_bio_religion,
        haspet: userProfile.user_bio_haspet === "1",
        prompts: userPrompts,
        interests: userInterests,
        socialLinks: userProfile.user_bio_social_links
          ? typeof userProfile.user_bio_social_links === "string"
            ? JSON.parse(userProfile.user_bio_social_links)
            : userProfile.user_bio_social_links
          : [],
      },

      preferences: {
        minimum_age: userProfile.user_preference_minimum_age,
        maximum_age: userProfile.user_preference_maximum_age,
        education: userProfile.user_preference_highesteducation,
        height_minimum: userProfile.user_preference_height_minimum,
        height_maximum: userProfile.user_preference_height_maximum,
        relationshipgoal: userProfile.user_preference_relationshipgoal,
        ethnicity: userProfile.user_preference_ethnicity,
        smoking: userProfile.user_preference_smoking,
        distance: userProfile.user_preference_distance,
        drinking: userProfile.user_preference_drinking,
        children: userProfile.user_preference_children,
        gender: userProfile.user_preference_gender,
        pet: userProfile.user_preference_pet,
        religion: userProfile.user_preference_religion,
        politicalview: userProfile.user_preference_politicalview,
        language: userProfile.user_preference_language
          ? typeof userProfile.user_preference_language === "string"
            ? JSON.parse(userProfile.user_preference_language)
            : userProfile.user_preference_language
          : [],
      },

      // stats
      stats: {
        streak_count: streak.count,
        // { count, days, activeToday, rewardsPending, reward: { roses, boosts } }
        streak,
      },

      // subscription
      subscription: subscription,

      // entitlements -- { tier, features }: what the server will actually allow.
      // The app should gate UI on these, never on the subscription's product name.
      entitlements,
      roses,
      directMessages,
      boosts,
      likesRemainingToday,
      rewind,

      active_status: userProfile.user_active,
      created_at: userProfile.user_datecreated,
      last_accessed: userProfile.user_last_accessed,
      device_stats: userProfile.user_signedup_device_stats,
    };
  } catch (err) {
    tools.serverLog(`Error in getProfile: ${err}`, "getProfile-101");
    response.message = "Database error retrieving profile.";
    response.err = err;
    response.code = 500;
  }

  return response;
}
