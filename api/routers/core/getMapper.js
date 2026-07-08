import { asc, eq, getTableColumns } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  gnEducationVariant,
  gnEthnicityVariant,
  gnIntentVariant,
  gnLanguageVariant,
  gnPoliticalviewVariant,
  gnReligionVariant,
  mappingLookup,
} from "../../db/schema.js";
import { tools, namer, envInt } from "../../global/functions.js";
import { redisDo } from "../../global/redisClient.js";
import { staticLookupMaps, gnLookupTables } from "../../db/mapper.js";
import { publicObjectsBaseUrl } from "../../global/s3bender.js";

const MAPPER_CACHE_TTL_SECONDS = envInt("MAPPER_CACHE_TTL_SECONDS", 60 * 60); // 1 hour -- admin-managed reference data, rarely changes

// Fixed enums and the gn_*_variant registry come from db/mapper.js.
const STATIC_MAPS = staticLookupMaps;

// Maps SQL table names to schema exports.
const SCHEMA_TABLES_BY_NAME = {
  gn_intent_variant: gnIntentVariant,
  gn_politicalview_variant: gnPoliticalviewVariant,
  gn_language_variant: gnLanguageVariant,
  gn_education_variant: gnEducationVariant,
  gn_ethnicity_variant: gnEthnicityVariant,
  gn_religion_variant: gnReligionVariant,
};

export default async function getMapper() {
  /** @type {any} */
  const response = {
    code: 404,
    message: "No mapper data found.",
    mapper_payload: {},
  };

  try {
    const cached = await redisDo(async (client) =>
      client.get(namer.redis.mapper),
    ).catch((err) => {
      tools.serverLog(`Redis read failed in getMapper: ${err}`, "getMapper-1");
      return null;
    });

    if (cached) {
      response.mapper_payload = JSON.parse(cached);
      response.code = 200;
      response.message = "ok";
      return response;
    }

    const rows = await db
      .select({
        map_id: mappingLookup.mapId,
        map_type: mappingLookup.mapType,
        map_code: mappingLookup.mapCode,
        map_label: mappingLookup.mapLabel,
      })
      .from(mappingLookup);
    // Start from the fixed enums; mapping_lookup rows override.
    /** @type {any} */
    const sql_map = JSON.parse(JSON.stringify(STATIC_MAPS));

    for (const r of rows) {
      if (
        !r.map_type ||
        r.map_code === undefined ||
        r.map_label === undefined
      ) {
        continue;
      }
      if (!sql_map[r.map_type]) {
        sql_map[r.map_type] = {};
      }

      if (r.map_type === "bio_interests") {
        try {
          Object.assign(sql_map[r.map_type], JSON.parse(r.map_label));
        } catch (e) {
          tools.serverLog(
            `Error parsing bio_interests map_label (map_id ${r.map_id}): ${e}`,
            "getMapper-102",
          );
        }
        continue;
      }

      sql_map[r.map_type][r.map_code] = r.map_label;
    }

    // Single string derived from the s3bender config, not a code map.
    sql_map.img_domain = publicObjectsBaseUrl();

    // gn_*_variant catalogs, keyed as bio_<type>.
    for (const [key, { table: tableName, codeColumn }] of Object.entries(
      gnLookupTables,
    )) {
      const table = SCHEMA_TABLES_BY_NAME[tableName];
      const columns = getTableColumns(table);
      const codeCol = Object.values(columns).find((c) => c.name === codeColumn);

      const variantRows = await db
        .select({ code: codeCol, label: table.label })
        .from(table)
        .where(eq(table.status, 1))
        .orderBy(asc(codeCol));
      if (variantRows.length > 0) {
        const group = {};
        for (const v of variantRows) {
          group[v.code] = v.label;
        }
        sql_map[key] = group;
      }
    }

    response.mapper_payload = sql_map;
    response.code = 200;
    response.message = "ok";

    await redisDo(async (client) => {
      await client.set(namer.redis.mapper, JSON.stringify(sql_map), {
        EX: MAPPER_CACHE_TTL_SECONDS,
      });
    }).catch((err) => {
      tools.serverLog(`Redis write failed in getMapper: ${err}`, "getMapper-2");
    });
  } catch (error) {
    tools.serverLog(`Error in getMapper: ${error}`, "getMapper-100");
    response.code = 500;
    response.message = "Internal server error.";
  }

  return response;
}
