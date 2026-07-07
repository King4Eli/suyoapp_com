import { createHash } from "crypto";
import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
// @ts-ignore
export default async function getVersioning({ _bi, _gm = false, _gpl = false }) {
  /** @type { any } */
  const response = { code: 404, message: "This empty." };
  try {


    // get mappers
    if (_bi === true && _gm === true) {
      /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
      const [rows] = await db_pool.query("SELECT * FROM mapping_lookup");
      /** @type { any } */
      const sql_map = {};
      if (Array.isArray(rows) && rows.length > 0) {
        for (const r of rows) {
          // Ensure required keys exist 
          if (!r.map_type || r.map_code === undefined || r.map_label === undefined) {
            continue;
          }
          // Ensure array exists for each type 
          if (!sql_map[r.map_type]) {
            sql_map[r.map_type] = {};
          }
          // Assign item 
          sql_map[r.map_type][r.map_code] = r.map_label;
        }
      }

      response.mapper_payload = sql_map;
      response.code = 200;
      response.message = "ok";
    }
  }
  catch (err) {
    tools.serverLog(`Error in getVersioning: ${err}`,"getVersioning-100");
    response.code = 500;
    response.message = "Unexpected error.";
  }
  return response;
}
