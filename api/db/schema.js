// Source of truth for the database. Edit here, then run migrate:create.

import {
  bigint,
  date,
  decimal,
  double,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  timestamp,
  tinyint,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const conversations = mysqlTable("conversations", {
  convoId: varchar("convo_id", { length: 50 }).primaryKey().notNull(),
  convoMatchId: varchar("convo_match_id", { length: 50 }).notNull(),
  convoMessage: longtext("convo_message").notNull(),
  convoByInitiator: mysqlEnum("convo_by_initiator", ["0", "1"]).notNull(),
  // 0=noread 1=read -99=deleted
  convoStatus: mysqlEnum("convo_status", ["0", "1", "-99"])
    .notNull()
    .default("0"),
  convoDateAdded: bigint("convo_date_added", { mode: "number", unsigned: true })
    .notNull()
    .default(sql`(unix_timestamp())`),
  convoDateUpdated: bigint("convo_date_updated", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .default(sql`(unix_timestamp())`),
});

export const feedComments = mysqlTable("feed_comments", {
  commentId: varchar("comment_id", { length: 50 }).primaryKey().notNull(),
  commentPostId: varchar("comment_post_id", { length: 50 }).notNull(),
  commentUserId: varchar("comment_user_id", { length: 50 }).notNull(),
  // NULL = top-level comment; otherwise a reply to comment_id (one level deep)
  commentParentId: varchar("comment_parent_id", { length: 50 }),
  commentText: text("comment_text").notNull(),
  // 1=active,-99=deleted
  commentStatus: mysqlEnum("comment_status", ["1", "-99"])
    .notNull()
    .default("1"),
  commentDateAdded: bigint("comment_dateAdded", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .default(sql`(unix_timestamp())`),
});

export const feedPosts = mysqlTable("feed_posts", {
  postId: varchar("post_id", { length: 50 }).primaryKey().notNull(),
  postUserId: varchar("post_user_id", { length: 50 }).notNull(),
  postCaption: text("post_caption"),
  // [{"type":"image","p":"/bucket/key"}] (video type reserved for a future pass, not implemented now)
  postMedia: json("post_media"),
  // 1=active,-99=deleted
  postStatus: mysqlEnum("post_status", ["1", "-99"]).notNull().default("1"),
  postDateAdded: bigint("post_dateAdded", { mode: "number", unsigned: true })
    .notNull()
    .default(sql`(unix_timestamp())`),
  postDateUpdated: bigint("post_dateUpdated", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .default(sql`(unix_timestamp())`),
});

export const feedReactions = mysqlTable("feed_reactions", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  reactionPostId: varchar("reaction_post_id", { length: 50 }).notNull(),
  // the viewer reacting
  reactionUserId: varchar("reaction_user_id", { length: 50 }).notNull(),
  reactionKind: mysqlEnum("reaction_kind", [
    "like",
    "love",
    "haha",
    "wow",
    "celebrate",
    "support",
  ])
    .notNull()
    .default("like"),
  reactionDateAdded: bigint("reaction_dateAdded", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .default(sql`(unix_timestamp())`),
});

export const gnEducationVariant = mysqlTable("gn_education_variant", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  code: smallint("code").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  status: tinyint("status").notNull().default(1),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const gnEthnicityVariant = mysqlTable("gn_ethnicity_variant", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  code: smallint("code").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  status: tinyint("status").notNull().default(1),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const gnIntentVariant = mysqlTable("gn_intent_variant", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  code: smallint("code").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  status: tinyint("status").notNull().default(1),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const gnInterestsVariant = mysqlTable("gn_interests_variant", {
  idAi: int("id_ai").primaryKey().notNull().autoincrement(),
  category: varchar("category", { length: 30 }).notNull(),
  interestedIn: varchar("interested_in", { length: 50 }).notNull(),
  status: tinyint("status").notNull().default(1),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const gnLanguageVariant = mysqlTable("gn_language_variant", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  code: smallint("code").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  status: tinyint("status").notNull().default(1),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const gnPoliticalviewVariant = mysqlTable("gn_politicalview_variant", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  code: smallint("code").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  status: tinyint("status").notNull().default(1),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const gnPromptsVariant = mysqlTable("gn_prompts_variant", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  question: varchar("question", { length: 255 }).notNull(),
  status: tinyint("status").notNull().default(1),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const gnReligionVariant = mysqlTable("gn_religion_variant", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  label: varchar("label", { length: 50 }).notNull(),
  status: tinyint("status").notNull().default(1),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const iapTransactions = mysqlTable("iap_transactions", {
  // Apple transactionId or Google purchaseToken
  transactionId: varchar("transaction_id", { length: 255 })
    .primaryKey()
    .notNull(),
  // 2=apple,3=google (matches subscriptions.external_platform)
  platform: tinyint("platform").notNull(),
  // store product id, must match product_list_variant.external_3rdparty_store_product_id
  productId: varchar("product_id", { length: 200 }).notNull(),
  variantIdRef: int("variant_id_ref").notNull(),
  userIdRef: varchar("user_id_ref", { length: 50 }).notNull(),
  paymentIdRef: varchar("payment_id_ref", { length: 50 }),
  // set for rewind one-time purchases
  matchIdRef: varchar("match_id_ref", { length: 50 }),
  // 0=pseudo (dev, unverified), 1=verified against Apple/Google
  verificationMode: tinyint("verification_mode").notNull().default(0),
  // raw verifyReceipt/App Store Server API/Play Developer API response, kept for support/debugging
  verificationResponse: json("verification_response"),
  // 0=pending,1=verified,2=failed
  status: tinyint("status").notNull().default(0),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const logsApplication = mysqlTable("logs_application", {
  reportId: varchar("report_id", { length: 50 }).primaryKey().notNull(),
  reportType: varchar("report_type", { length: 30 })
    .notNull()
    .default("undefined"),
  reportStatus: tinyint("report_status").notNull().default(0),
  reportData: longtext("report_data").notNull(),
  reportCurrentuser: varchar("report_currentuser", { length: 50 }),
  // references users_devices.device_id; replaces embedding full device info per log
  deviceId: varchar("device_id", { length: 191 }),
  createdAt: bigint("created_at", { mode: "number", unsigned: true })
    .notNull()
    .default(sql`(unix_timestamp())`),
  updatedAt: bigint("updated_at", { mode: "number", unsigned: true })
    .notNull()
    .default(sql`(unix_timestamp())`),
});

export const mappingLookup = mysqlTable("mapping_lookup", {
  mapId: int("map_id").primaryKey().notNull().autoincrement(),
  mapType: mysqlEnum("map_type", [
    "bio_interests",
    "bio_religion",
    "bundle_version",
    "img_domain",
  ]).notNull(),
  mapCode: tinyint("map_code").notNull(),
  mapLabel: text("map_label").notNull(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
});

export const matches = mysqlTable("matches", {
  matchId: varchar("match_id", { length: 50 }).primaryKey().notNull(),
  matchUserIdFrom: varchar("match_user_id_from", { length: 50 }).notNull(),
  matchUserIdTo: varchar("match_user_id_to", { length: 50 }).notNull(),
  // 0=waiting,1=match,2=notinterested,3=block,4=reported,5=rose
  matchStatus: mysqlEnum("match_status", ["0", "1", "2", "3", "4", "5"])
    .notNull()
    .default("0"),
  lastMessageId: varchar("last_message_id", { length: 50 }),
  matchDateAdded: bigint("match_dateAdded", { mode: "number", unsigned: true })
    .notNull()
    .default(sql`(unix_timestamp())`),
  matchDateUpdated: bigint("match_dateUpdated", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .default(sql`(unix_timestamp())`),
});

export const payments = mysqlTable("payments", {
  paymentId: varchar("payment_id", { length: 50 }).primaryKey().notNull(),
  pAmount: decimal("p_amount", { precision: 10, scale: 2 }).notNull(),
  pCurrency: varchar("p_currency", { length: 10 }).default("USD"),
  // 1=sub,2=onetime
  type: tinyint("type").notNull(),
  // 0=pending, 1=completed, 2=refunded, 3=failed, 4=expired
  status: tinyint("status").notNull().default(0),
  // from Stripe/PayPal/Apple/Google
  pTransactionReference: varchar("p_transaction_reference", { length: 255 }),
  userIdRef: varchar("user_id_ref", { length: 50 }).notNull(),
  variantRef: int("variant_ref").notNull(),
  pCreatedAt: timestamp("p_created_at").notNull().defaultNow(),
  pUpdatedAt: timestamp("p_updated_at").notNull().defaultNow().onUpdateNow(),
});

export const productListVariant = mysqlTable("product_list_variant", {
  idAi: int("id_ai").primaryKey().notNull().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  description: json("description").notNull(),
  price: decimal("price", { precision: 11, scale: 2 })
    .notNull()
    .default("0.00"),
  billingCycle: tinyint("billing_cycle").notNull().default(1),
  productListsIdRef: varchar("product_lists_id_ref", { length: 200 }).notNull(),
  active: mysqlEnum("active", ["0", "1"]).notNull().default("0"),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateUpdated: timestamp("date_updated").notNull().defaultNow().onUpdateNow(),
  external_3rdpartyStoreProductId: text(
    "external_3rdparty_store_product_id",
  ).notNull(),
});

export const productLists = mysqlTable("product_lists", {
  plSku: varchar("pl_sku", { length: 200 }).primaryKey().notNull(),
  plName: varchar("pl_name", { length: 200 }).notNull(),
  plDescription: json("pl_description").notNull(),
  category: varchar("category", { length: 15 }).notNull(),
  plIsActive: mysqlEnum("pl_is_active", ["0", "1"]).notNull(),
  plCreated: timestamp("pl_created").notNull(),
  plUpdated: timestamp("pl_updated").notNull().defaultNow().onUpdateNow(),
});

export const stripeEvents = mysqlTable("stripe_events", {
  eventId: varchar("event_id", { length: 100 }).primaryKey().notNull(),
  eventType: varchar("event_type", { length: 100 }),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

export const subscriptions = mysqlTable("subscriptions", {
  id: varchar("id", { length: 50 }).primaryKey().notNull(),
  userId: varchar("user_id", { length: 50 }).notNull(),
  variantIdRef: int("variant_id_ref").notNull(),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date").notNull(),
  externalPlatform: tinyint("external_platform").notNull(),
  // stripe/google/ios
  externalId: varchar("external_id", { length: 200 }).notNull(),
  paymentIdRef: varchar("payment_id_ref", { length: 50 }),
  status: tinyint("status").notNull(),
  // user or Stripe requested cancellation effective at end_date
  cancelAtPeriodEnd: tinyint("cancel_at_period_end").notNull().default(0),
  canceledAt: timestamp("canceled_at"),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateModified: timestamp("date_modified").notNull().defaultNow().onUpdateNow(),
});

export const userBoostUsage = mysqlTable("user_boost_usage", {
  userId: varchar("user_id", { length: 50 }).primaryKey().notNull(),
  // purchased boosts not yet used
  boostBalance: int("boost_balance").notNull().default(0),
});

export const userRoseUsage = mysqlTable("user_rose_usage", {
  userId: varchar("user_id", { length: 50 }).primaryKey().notNull(),
  // purchased roses
  roseBalance: int("rose_balance").notNull().default(0),
  // free-tier roses used on daily_reset_date
  dailyUsed: int("daily_used").notNull().default(0),
  // the date daily_used applies to
  dailyResetDate: date("daily_reset_date", { mode: "string" })
    .notNull()
    .default(sql`(curdate())`),
});

export const users = mysqlTable("users", {
  // AUTO_INCREMENT needs an index; user_id is the primary key.
  autoIncrement: bigint("autoIncrement", { mode: "number" })
    .notNull()
    .autoincrement()
    .unique(),
  userId: varchar("user_id", { length: 50 }).primaryKey().notNull(),
  userEmail: varchar("user_email", { length: 250 }).notNull(),
  userPhonenumber: varchar("user_phonenumber", { length: 15 }).notNull(),
  userPhonenumberMeta: json("user_phonenumber_meta"),
  userFullname: text("user_fullname").notNull(),
  userImage: longtext("user_image"),
  userActive: mysqlEnum("user_active", ["0", "1", "2", "3", "-99"])
    .notNull()
    .default("1"),
  // unix seconds, set when user_active becomes -99 (deleted)
  userDeletedDate: int("user_deleted_date", { unsigned: true }),
  // { phonenumber, reason } -- user_phonenumber is cleared on delete so the
  // number can sign up again; the original is kept here
  userDeleteData: json("user_delete_data"),
  geoMeta: json("geo_meta").notNull(),
  geoHash: varchar("geo_hash", { length: 12 }).notNull(),
  geoLong: double("geo_long").notNull(),
  geoLatd: double("geo_latd").notNull(),
  userVerified: mysqlEnum("user_verified", ["0", "1"]).notNull().default("0"),
  userDatecreated: timestamp("user_datecreated").notNull().defaultNow(),
  userLastAccessed: timestamp("user_last_accessed")
    .notNull()
    .defaultNow()
    .onUpdateNow(),
  userSignedupDeviceStats: text("user_signedup_device_stats").notNull(),
  userBioHighesteducation: tinyint("user_bio_highesteducation"),
  userBioRelationshipgoal: tinyint("user_bio_relationshipgoal"),
  userBioSchoolattended: varchar("user_bio_schoolattended", { length: 50 }),
  userBioPoliticalview: tinyint("user_bio_politicalview"),
  userBioHometown: varchar("user_bio_hometown", { length: 50 }),
  userBioLanguage: longtext("user_bio_language"),
  userBioCompany: varchar("user_bio_company", { length: 30 }),
  userBioEthnicity: tinyint("user_bio_ethnicity"),
  userBioSmoking: mysqlEnum("user_bio_smoking", ["0", "1", "2"]).notNull(),
  userBioDrinking: mysqlEnum("user_bio_drinking", ["0", "1", "2"]).notNull(),
  userBioChildren: mysqlEnum("user_bio_children", ["0", "1"]).notNull(),
  userBioReligion: tinyint("user_bio_religion"),
  userBioJobrole: varchar("user_bio_jobrole", { length: 20 }),
  userBioGender: int("user_bio_gender").notNull(),
  userBioHaspet: mysqlEnum("user_bio_haspet", ["0", "1"]).notNull(),
  userBioAbout: varchar("user_bio_about", { length: 400 }).notNull(),
  // in cm, 100-220
  userBioHeight: int("user_bio_height"),
  // yyyyMmDd
  userBioDob: varchar("user_bio_dob", { length: 8 }).notNull(),
  userPreferenceMinimumAge: tinyint("user_preference_minimum_age")
    .notNull()
    .default(18),
  userPreferenceMaximumAge: tinyint("user_preference_maximum_age")
    .notNull()
    .default(25),
  userPreferenceHighesteducation: tinyint("user_preference_highesteducation")
    .notNull()
    .default(-99),
  // in cm, 100-220
  userPreferenceHeightMinimum: int("user_preference_height_minimum")
    .notNull()
    .default(153),
  // in cm, 100-220
  userPreferenceHeightMaximum: int("user_preference_height_maximum")
    .notNull()
    .default(180),
  userPreferenceRelationshipgoal: tinyint("user_preference_relationshipgoal")
    .notNull()
    .default(-99),
  userPreferenceEthnicity: tinyint("user_preference_ethnicity")
    .notNull()
    .default(-99),
  // -99=any
  userPreferenceSmoking: mysqlEnum("user_preference_smoking", [
    "0",
    "1",
    "2",
    "-99",
  ])
    .notNull()
    .default("-99"),
  // >100 global
  userPreferenceDistance: int("user_preference_distance").notNull().default(55),
  // -99=any
  userPreferenceDrinking: mysqlEnum("user_preference_drinking", [
    "0",
    "1",
    "2",
    "-99",
  ])
    .notNull()
    .default("-99"),
  userPreferenceChildren: mysqlEnum("user_preference_children", [
    "0",
    "1",
    "-99",
  ])
    .notNull()
    .default("-99"),
  userPreferenceGender: tinyint("user_preference_gender")
    .notNull()
    .default(-99),
  userPreferencePet: mysqlEnum("user_preference_pet", ["0", "1", "-99"])
    .notNull()
    .default("-99"),
  userPreferenceReligion: tinyint("user_preference_religion")
    .notNull()
    .default(-99),
  userPreferencePoliticalview: tinyint("user_preference_politicalview")
    .notNull()
    .default(-99),
  userPreferenceLanguage: longtext("user_preference_language"),
  userSettings: longtext("user_settings").notNull(),
  userPrivacyShowDistance: mysqlEnum("user_privacy_show_distance", ["0", "1"])
    .notNull()
    .default("1"),
  userPrivacyShowAge: mysqlEnum("user_privacy_show_age", ["0", "1"])
    .notNull()
    .default("1"),
  userPrivacyIncognito: mysqlEnum("user_privacy_incognito", ["0", "1"])
    .notNull()
    .default("0"),
  // VIP-only; mutual -- both sides must have this on to see each others read receipts
  userPrivacyReadReceipts: mysqlEnum("user_privacy_read_receipts", ["0", "1"])
    .notNull()
    .default("0"),
  userBioSocialLinks: longtext("user_bio_social_links"),
});

export const usersDevices = mysqlTable("users_devices", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  // most recently seen owner of this device
  userId: varchar("user_id", { length: 50 }).notNull(),
  // DeviceInfo.getUniqueId() from the client
  deviceId: varchar("device_id", { length: 191 }).notNull(),
  deviceName: varchar("device_name", { length: 150 }),
  deviceModel: varchar("device_model", { length: 100 }),
  deviceBrand: varchar("device_brand", { length: 100 }),
  // Handset, Tablet, Tv, etc
  deviceType: varchar("device_type", { length: 30 }),
  manufacturer: varchar("manufacturer", { length: 100 }),
  // e.g. iOS_17.4, Android_14
  deviceOs: varchar("device_os", { length: 100 }),
  carrier: varchar("carrier", { length: 100 }),
  userAgent: varchar("user_agent", { length: 255 }),
  screenWidth: smallint("screen_width", { unsigned: true }),
  screenHeight: smallint("screen_height", { unsigned: true }),
  isEmulator: tinyint("is_emulator").notNull().default(0),
  appVersion: varchar("app_version", { length: 30 }),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateMod: timestamp("date_mod").notNull().defaultNow().onUpdateNow(),
});

export const usersInterests = mysqlTable("users_interests", {
  idAi: int("id_ai").primaryKey().notNull().autoincrement(),
  userId: varchar("user_id", { length: 250 }).notNull(),
  interestsVariantRefId: int("interests_variant_ref_id").notNull(),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
});

export const usersPrompt = mysqlTable("users_prompt", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  userId: varchar("user_id", { length: 250 }).notNull(),
  promptsVariantRefId: bigint("prompts_variant_ref_id", {
    mode: "number",
  }).notNull(),
  answer: varchar("answer", { length: 100 }).notNull(),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
});

export const usersReported = mysqlTable("users_reported", {
  idAi: bigint("id_ai", { mode: "number" })
    .primaryKey()
    .notNull()
    .autoincrement(),
  userId: varchar("user_id", { length: 50 }).notNull(),
  // the user who filed the report
  reporterUserId: varchar("reporter_user_id", { length: 50 }),
  // the feed post this report originated from, if any (NULL for profile-level reports)
  reportedPostId: varchar("reported_post_id", { length: 50 }),
  status: tinyint("status").notNull().default(0),
  reason: text("reason").notNull(),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  dateMod: timestamp("date_mod").notNull().defaultNow().onUpdateNow(),
});
