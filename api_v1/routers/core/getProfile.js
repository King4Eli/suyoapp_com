import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";

export default async function getProfile() {
  /** @type { any } */
  const response = { code: 404, message: "Error getting your profile!" };

  try {
    // Fetch user profile with ALL fields from schema
    const userSql = `SELECT 
      user_id,
      user_fullname,
      user_email,
      user_bio_dob,
      user_phonenumber,
      user_phonenumber_meta,
      user_image,
      user_active,
      geo_latd,
      geo_long,
      geo_hash,
      geo_meta,
      user_verified,
      user_datecreated,
      user_last_accessed,
      user_signedup_device_stats,
      user_bio_highesteducation,
      user_auth_verificationcode,
      user_bio_relationshipgoal,
      user_bio_schoolattended,
      user_bio_politicalview,
      user_bio_hometown,
      user_bio_language,
      user_bio_bodytype,
      user_bio_company,
      user_bio_ethnicity,
      user_bio_smoking,
      user_bio_drinking,
      user_bio_children,
      user_bio_religion,
      user_bio_jobrole,
       user_bio_gender,
      user_bio_haspet,
      user_bio_about,
      user_bio_height,
      user_bio_dob,
      user_preference_minimum_age,
      user_preference_maximum_age,
      user_preference_highesteducation,
      user_preference_height_minimum,
      user_preference_height_maximum,
      user_preference_relationshipgoal,
      user_preference_bodytype,
      user_preference_ethnicity,
      user_preference_smoking,
      user_preference_distance,
      user_preference_drinking,
      user_preference_children,
      user_preference_gender,
      user_preference_pet,
      user_preference_religion,
      user_preference_language,
      user_settings
    FROM users 
    WHERE user_id = ?
    LIMIT 1`;

    /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
    const [userRows] = await db_pool.query(userSql, [sessions.currentUserID]);

    if (!Array.isArray(userRows) || userRows.length === 0) {
      return response;
    }

    const userProfile = userRows?.[0];

    // Fetch active subscription if exists
    let subscription = null;
    const subscriptionSql = `SELECT
      s.id AS subscription_id,
      s.variant_id_ref,
      s.start_date,
      s.end_date,
      s.external_platform,
      s.external_id,
      s.payment_id_ref,
      s.status,
      pv.name AS plan_name,
      pv.description AS plan_description,
      pv.price AS plan_price,
      pv.billing_cycle,
      pl.pl_sku,
      pl.pl_name AS product_name,
      pl.pl_description AS product_description,
      p.payment_id,
      p.status AS payment_status,
      p.p_amount AS payment_amount,
      p.p_currency AS payment_currency
    FROM subscriptions s
    LEFT JOIN product_list_variant pv
      ON s.variant_id_ref = pv.id_ai
    LEFT JOIN product_lists pl
      ON pv.product_lists_id_ref = pl.pl_sku
    LEFT JOIN payments p
      ON s.payment_id_ref = p.payment_id
    WHERE s.user_id = ?
      AND s.status = 1
      AND s.end_date > NOW()
    ORDER BY s.date_created DESC
    LIMIT 1`;

    /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
    const [subRows] = await db_pool.query(subscriptionSql, [sessions.currentUserID]);

    if (Array.isArray(subRows) && subRows.length > 0) {
      const subData = subRows[0];// as any;

      subscription = {
        id: subData.subscription_id,
        variant_id: subData.variant_id_ref,
        plan_name: subData.plan_name,
        plan_description: subData.plan_description,
        plan_price: parseFloat(subData.plan_price),
        billing_cycle: subData.billing_cycle,
        product_name: subData.product_name,
        product_description: subData.product_description,
        platform: subData.external_platform,
        external_id: subData.external_id,
        payment_id: subData.payment_id,
        payment_status: subData.payment_status,
        payment_amount: parseFloat(subData.payment_amount),
        payment_currency: subData.payment_currency,
        start_date: subData.start_date,
        end_date: subData.end_date,
        status: 'active',
        days_remaining: Math.max(0, Math.ceil((new Date(subData.end_date)?.getTime() - new Date()?.getTime()) / (1000 * 60 * 60 * 24)))
      };
    }

    // Fetch user's selected prompts
    /** @type {  any[] } */
    let userPrompts = [];
    const promptsSql = `
      SELECT pv.id_ai, pv.question, up.answer
      FROM users_prompt up
      INNER JOIN prompts_variant pv ON up.prompts_variant_ref_id = pv.id_ai
      WHERE up.user_id = ? AND pv.status = 1
      ORDER BY up.date_created ASC
    `;
    try {
      /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
      const [promptsRows] = await db_pool.query(promptsSql, [sessions.currentUserID]);
      if (Array.isArray(promptsRows)) {
        userPrompts = promptsRows.map(row => ({
          id_ai: Number(row.id_ai),
          question: String(row.question ?? ''),
          answer: String(row.answer ?? '')
        }));
      }
    } catch (e) {
       tools.serverLog(`Error fetching user prompts: ${e}`,"getProfile-1");
      userPrompts = [];
    }

    // Fetch user's selected interests
    /** @type {  any[] } */
    let userInterests = [];
    const interestsSql = `
      SELECT iv.id_ai, iv.category, iv.interested_in
      FROM users_interests ui
      INNER JOIN interests_variant iv ON ui.interests_variant_ref_id = iv.id_ai
      WHERE ui.user_id = ? AND iv.status = 1
      ORDER BY iv.category ASC, iv.id_ai ASC
    `;
    try {
      /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
      const [interestsRows] = await db_pool.query(interestsSql, [sessions.currentUserID]);
      if (Array.isArray(interestsRows)) {
        /** @type { Record<string, any[]> } */
        const grouped = {};
        for (const row of interestsRows) {
          const category = String(row.category ?? 'Unknown');
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push({
            id_ai: Number(row.id_ai),
            interested_in: String(row.interested_in ?? '')
          });
        }
        userInterests = Object.keys(grouped).map(category => ({
          category,
          items: grouped[category]
        }));
      }
    } catch (e) {
       tools.serverLog(`Error fetching user interests: ${e}`,"getProfile-105");
      userInterests = [];
    }

    // Parse JSON fields with error handling
    let userImage = [];
    let userSettings = {};
    let userLocation = {};

    try {
      userImage = userProfile?.user_image ? JSON.parse(userProfile.user_image) : [];
    } catch (e) {
       tools.serverLog(`Error parsing user_image for user ${sessions.currentUserID}: ${e}`, "getProfile-102");
      userImage = [];
    }

    try {
      userSettings = userProfile.user_settings ? JSON.parse(userProfile.user_settings) : {};
    } catch (e) {
       tools.serverLog(`Error parsing user_settings for user ${sessions.currentUserID}: ${e}`,"getProfile-103");
      userSettings = {};
    }
    userLocation = (userProfile.geo_meta ??  {} );
     
    const streakCount = Number(userProfile?.user_last_accessed ?? 0);
    const hasActiveSubscription = subscription !== null;

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
        phonenumber_meta: userProfile.user_phonenumber_meta ? (typeof userProfile.user_phonenumber_meta === 'string' ? JSON.parse(userProfile.user_phonenumber_meta) : userProfile.user_phonenumber_meta) : null,
        images: userImage,
        location: userLocation,
        settings: userSettings,
        verified: userProfile.user_verified === '1',
      },

      // Bio Information
      bio: {
        about: userProfile.user_bio_about,
        dob: userProfile.user_bio_dob,
        height: userProfile.user_bio_height,
        gender: userProfile.user_bio_gender,
        ethnicity: userProfile.user_bio_ethnicity,
        bodytype: userProfile.user_bio_bodytype,
        education: userProfile.user_bio_highesteducation,
        relationshipgoal: userProfile.user_bio_relationshipgoal,
        school: userProfile.user_bio_schoolattended,
        political_view: userProfile.user_bio_politicalview,
        hometown: userProfile.user_bio_hometown,
        language: userProfile.user_bio_language ? (typeof userProfile.user_bio_language === 'string' ? JSON.parse(userProfile.user_bio_language) : userProfile.user_bio_language) : [],
        company: userProfile.user_bio_company,
        jobrole: userProfile.user_bio_jobrole,
        smoking: userProfile.user_bio_smoking,
        drinking: userProfile.user_bio_drinking,
        children: userProfile.user_bio_children,
        religion: userProfile.user_bio_religion,
        haspet: userProfile.user_bio_haspet === '1',
        prompts: userPrompts,
        interests: userInterests,
      },

      preferences: {
        minimum_age: userProfile.user_preference_minimum_age,
        maximum_age: userProfile.user_preference_maximum_age,
        education: userProfile.user_preference_highesteducation,
        height_minimum: userProfile.user_preference_height_minimum,
        height_maximum: userProfile.user_preference_height_maximum,
        relationshipgoal: userProfile.user_preference_relationshipgoal,
        bodytype: userProfile.user_preference_bodytype,
        ethnicity: userProfile.user_preference_ethnicity,
        smoking: userProfile.user_preference_smoking,
        distance: userProfile.user_preference_distance,
        drinking: userProfile.user_preference_drinking,
        children: userProfile.user_preference_children,
        gender: userProfile.user_preference_gender,
        pet: userProfile.user_preference_pet,
        religion: userProfile.user_preference_religion,
        language: userProfile.user_preference_language ? (typeof userProfile.user_preference_language === 'string' ? JSON.parse(userProfile.user_preference_language) : userProfile.user_preference_language) : []
      },

      // stats
      stats: {
        streak_count: streakCount,
         },
 
      // subscription
      subscription: subscription,

      active_status: userProfile.user_active,
      created_at: userProfile.user_datecreated,
      last_accessed: userProfile.user_last_accessed,
      device_stats: userProfile.user_signedup_device_stats,
    };

  } catch (err) {
    tools.serverLog(`Error in getProfile: ${err}`,"getProfile-101");
    response.message = "Database error retrieving profile.";
    response.err = err;
    response.code = 500;
  }

  return response;
}
