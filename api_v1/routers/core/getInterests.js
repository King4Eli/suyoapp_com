import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";

export default async function getInterests() {
  /** @type { any } */
  const response = {
    code: 404,
    message: "No interests found.",
    interests: [],
  };

  const sql = `
        SELECT id_ai, category, interested_in
        FROM interests_variant
        WHERE status = 1
        ORDER BY category ASC, id_ai ASC
    `;

  try {
    /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
    const [rows] = await db_pool.query(sql);

    if (Array.isArray(rows) && rows.length > 0) {
      /** @type { Record<string, any[]> } */
      const grouped = {}; // { category: [{ id_ai, interested_in }] }

      for (const row of rows) {
        const category = String(row.category ?? "Unknown");
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push({
          id_ai: Number(row.id_ai),
          interested_in: String(row.interested_in ?? ""),
        });
      }

      response.code = 200;
      response.message = "ok";
      response.interests = Object.keys(grouped).map((category) => ({
        category,
        items: grouped[category],
      }));
    }
  } catch (error) {
    tools.serverLog(`Error in getInterests: ${error}`, "getInterests-100");
    response.code = 500;
    response.message = "Internal server error";
  }

  return response;
}
