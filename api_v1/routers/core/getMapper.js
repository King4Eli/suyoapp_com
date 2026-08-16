import db_pool from "../../global/database.js";
import { tools, namer, envInt } from "../../global/functions.js";
import { redisDo } from "../../global/redisClient.js";

const MAPPER_CACHE_TTL_SECONDS = envInt("MAPPER_CACHE_TTL_SECONDS", 60 * 60); // 1 hour -- admin-managed reference data, rarely changes

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

    // Dumps every map_type as { map_type: { map_code: map_label } },
    // used by app init to seed __MAPPER.
    /** @type {[any[], any]} */
    const [rows] = await db_pool.query("SELECT * FROM mapping_lookup");
    /** @type {any} */
    const sql_map = {};

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
        // map_label stores a JSON-encoded { category: [items] } blob per row
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
