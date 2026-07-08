// Fixed enums and the bio_* to gn_*_variant registry used by getMapper.js.

export const staticLookupMaps = {
  bio_gender: { 0: "woman", 1: "man" },
  account_status: {
    0: "snooze",
    1: "active",
    2: "locked",
    3: "banned",
    99: "deleted",
  },
  account_verified: { 0: "no", 1: "yes", 2: "pending" },
  bio_children: { 0: "no", 1: "yes" },
  bio_smoking: { 0: "no", 1: "yes", 2: "sometimes" },
  bio_drinking: { 0: "no", 1: "yes", 2: "occasionally" },
  bio_pets: { 0: "no", 1: "yes" },
  bio_premium: { 0: "free", 1: "premium", 2: "vip" },
  convo_status: { 0: "unread", 1: "read", 99: "deleted" },
};

// gn_religion_variant has no code column; id_ai is the code.
export const gnLookupTables = {
  bio_intent: { table: "gn_intent_variant", codeColumn: "code" },
  bio_politicalview: { table: "gn_politicalview_variant", codeColumn: "code" },
  bio_language: { table: "gn_language_variant", codeColumn: "code" },
  bio_education: { table: "gn_education_variant", codeColumn: "code" },
  bio_ethnicity: { table: "gn_ethnicity_variant", codeColumn: "code" },
  bio_religion: { table: "gn_religion_variant", codeColumn: "id_ai" },
};
