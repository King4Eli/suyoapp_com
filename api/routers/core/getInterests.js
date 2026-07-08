import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { gnInterestsVariant } from "../../db/schema.js";
import { tools } from "../../global/functions.js";

export default async function getInterests() {
  /** @type { any } */
  const response = {
    code: 404,
    message: "No interests found.",
    interests: [],
  };

  try {
    const rows = await db
      .select({
        id_ai: gnInterestsVariant.idAi,
        category: gnInterestsVariant.category,
        interested_in: gnInterestsVariant.interestedIn,
      })
      .from(gnInterestsVariant)
      .where(eq(gnInterestsVariant.status, 1))
      .orderBy(asc(gnInterestsVariant.category), asc(gnInterestsVariant.idAi));

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
