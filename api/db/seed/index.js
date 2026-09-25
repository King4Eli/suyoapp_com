// Seeds reference data (gn_*_variant, mapping_lookup, products). Re-runnable:
// missing rows are inserted, changed rows updated. Excludes users and
// user-generated tables.
//   node --env-file=../.env/db.env db/seed/index.js

import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { and, eq } from "drizzle-orm";
import { createClient } from "redis";
import { namer } from "../../global/namer.js";
import {
  gnEducationVariant,
  gnEthnicityVariant,
  gnIntentVariant,
  gnInterestsVariant,
  gnLanguageVariant,
  gnPoliticalviewVariant,
  gnPromptsVariant,
  gnReligionVariant,
  mappingLookup,
  productLists,
  productListVariant,
} from "../schema.js";
import { gnEducationVariant as gnEducationVariantData } from "./data/gn-education-variant.js";
import { gnEthnicityVariant as gnEthnicityVariantData } from "./data/gn-ethnicity-variant.js";
import { gnIntentVariant as gnIntentVariantData } from "./data/gn-intent-variant.js";
import { gnInterestsVariant as gnInterestsVariantData } from "./data/gn-interests-variant.js";
import { gnLanguageVariant as gnLanguageVariantData } from "./data/gn-language-variant.js";
import { gnPoliticalviewVariant as gnPoliticalviewVariantData } from "./data/gn-politicalview-variant.js";
import { gnPromptsVariant as gnPromptsVariantData } from "./data/gn-prompts-variant.js";
import { gnReligionVariant as gnReligionVariantData } from "./data/gn-religion-variant.js";
import { mappingLookup as mappingLookupData } from "./data/mapping-lookup.js";
import { productLists as productListsData } from "./data/product-lists.js";
import { productListVariant as productListVariantData } from "./data/product-list-variant.js";

/** Insert missing rows, update changed rows in place. */
async function upsertTable(
  db,
  table,
  label,
  rows,
  keyFn,
  whereFn,
  contentFn,
  updateFieldsFn,
) {
  const existing = await db.select().from(table);
  const existingByKey = new Map(existing.map((r) => [keyFn(r), r]));

  const toInsert = [];
  let updated = 0;
  let unchanged = 0;

  for (const row of rows) {
    const match = existingByKey.get(keyFn(row));
    if (!match) {
      toInsert.push(row);
      continue;
    }
    if (contentFn(match) === contentFn(row)) {
      unchanged++;
      continue;
    }
    await db.update(table).set(updateFieldsFn(row)).where(whereFn(row));
    updated++;
  }

  if (toInsert.length > 0) {
    await db.insert(table).values(toInsert);
  }
  console.log(
    `${label}: inserted ${toInsert.length}, updated ${updated}, unchanged ${unchanged}`,
  );
}

/**
 * Insert missing rows. When a row's content changed, retire the old row
 * (status 0) and insert a new one, matching the admin versioned-edit flow.
 */
async function versionedSeedTable(
  db,
  table,
  label,
  rows,
  codeFn,
  whereFn,
  contentFn,
) {
  const existingActive = await db
    .select()
    .from(table)
    .where(eq(table.status, 1));
  const activeByCode = new Map(existingActive.map((r) => [codeFn(r), r]));

  const toInsert = [];
  let retired = 0;
  let unchanged = 0;

  for (const row of rows) {
    const match = activeByCode.get(codeFn(row));
    if (!match) {
      toInsert.push(row);
      continue;
    }
    if (contentFn(match) === contentFn(row)) {
      unchanged++;
      continue;
    }
    await db
      .update(table)
      .set({ status: 0 })
      .where(and(whereFn(row), eq(table.status, 1)));
    toInsert.push(row);
    retired++;
  }

  if (toInsert.length > 0) {
    await db.insert(table).values(toInsert);
  }
  console.log(
    `${label}: inserted ${toInsert.length} (${retired} superseding a retired row), unchanged ${unchanged}`,
  );
}

async function main() {
  const conn = await createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "mydb",
  });
  const db = drizzle(conn, { mode: "default" });

  try {
    await versionedSeedTable(
      db,
      gnEducationVariant,
      "gn_education_variant",
      gnEducationVariantData,
      (r) => r.code,
      (r) => eq(gnEducationVariant.code, r.code),
      (r) => r.label,
    );
    await versionedSeedTable(
      db,
      gnEthnicityVariant,
      "gn_ethnicity_variant",
      gnEthnicityVariantData,
      (r) => r.code,
      (r) => eq(gnEthnicityVariant.code, r.code),
      (r) => r.label,
    );
    await versionedSeedTable(
      db,
      gnIntentVariant,
      "gn_intent_variant",
      gnIntentVariantData,
      (r) => r.code,
      (r) => eq(gnIntentVariant.code, r.code),
      (r) => r.label,
    );
    await versionedSeedTable(
      db,
      gnLanguageVariant,
      "gn_language_variant",
      gnLanguageVariantData,
      (r) => r.code,
      (r) => eq(gnLanguageVariant.code, r.code),
      (r) => r.label,
    );
    await versionedSeedTable(
      db,
      gnPoliticalviewVariant,
      "gn_politicalview_variant",
      gnPoliticalviewVariantData,
      (r) => r.code,
      (r) => eq(gnPoliticalviewVariant.code, r.code),
      (r) => r.label,
    );
    // No separate code column: insert-only.
    await versionedSeedTable(
      db,
      gnPromptsVariant,
      "gn_prompts_variant",
      gnPromptsVariantData,
      (r) => r.question,
      (r) => eq(gnPromptsVariant.question, r.question),
      (r) => r.question,
    );
    await versionedSeedTable(
      db,
      gnInterestsVariant,
      "gn_interests_variant",
      gnInterestsVariantData,
      (r) => `${r.category}::${r.interestedIn}`,
      (r) =>
        and(
          eq(gnInterestsVariant.category, r.category),
          eq(gnInterestsVariant.interestedIn, r.interestedIn),
        ),
      (r) => `${r.category}::${r.interestedIn}`,
    );

    // id_ai 0 is treated as "auto-generate" by default. Scoped to this
    // table only: leaving it on breaks every other table's auto-increment.
    await conn.query(
      "SET SESSION sql_mode = CONCAT(@@sql_mode, ',NO_AUTO_VALUE_ON_ZERO')",
    );
    await upsertTable(
      db,
      gnReligionVariant,
      "gn_religion_variant",
      gnReligionVariantData,
      (r) => r.idAi,
      (r) => eq(gnReligionVariant.idAi, r.idAi),
      (r) => r.label,
      (r) => ({ label: r.label, status: r.status }),
    );
    await conn.query(
      "SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, ',NO_AUTO_VALUE_ON_ZERO', ''))",
    );
    await upsertTable(
      db,
      mappingLookup,
      "mapping_lookup",
      mappingLookupData,
      (r) => `${r.mapType}::${r.mapCode}`,
      (r) =>
        and(
          eq(mappingLookup.mapType, r.mapType),
          eq(mappingLookup.mapCode, r.mapCode),
        ),
      (r) => r.mapLabel,
      (r) => ({ mapLabel: r.mapLabel }),
    );
    // Products before variants.
    await upsertTable(
      db,
      productLists,
      "product_lists",
      productListsData,
      (r) => r.plSku,
      (r) => eq(productLists.plSku, r.plSku),
      (r) =>
        JSON.stringify([r.plName, r.plDescription, r.category, r.plIsActive]),
      (r) => ({
        plName: r.plName,
        plDescription: r.plDescription,
        category: r.category,
        plIsActive: r.plIsActive,
      }),
    );
    await upsertTable(
      db,
      productListVariant,
      "product_list_variant",
      productListVariantData,
      (r) => r.idAi,
      (r) => eq(productListVariant.idAi, r.idAi),
      (r) =>
        JSON.stringify([
          r.name,
          r.description,
          r.price,
          r.billingCycle,
          r.productListsIdRef,
          r.active,
          r.external_3rdpartyStoreProductId,
        ]),
      (r) => ({
        name: r.name,
        description: r.description,
        price: r.price,
        billingCycle: r.billingCycle,
        productListsIdRef: r.productListsIdRef,
        active: r.active,
        external_3rdpartyStoreProductId: r.external_3rdpartyStoreProductId,
      }),
    );

    // Clear the cached mapper and products payloads (getProducts caches
    // prices). Own client: redisClient.js pulls in Stripe.
    const redis = createClient({
      socket: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        reconnectStrategy: false,
      },
    });
    redis.on("error", () => {});
    try {
      await redis.connect();
      await redis.del([namer.redis.mapper, namer.redis.products]);
      console.log("Flushed mapper and products cache in Redis.");
    } catch (err) {
      console.error(
        "Redis flush failed (seed data still applied):",
        err.message,
      );
    } finally {
      redis.destroy();
    }

    console.log("Done.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
