import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { gnReligionVariant } from "../../db/schema.js";
import { tools } from "../../global/functions.js";

export default async function getReligions() {
  /** @type { any } */
  const response = {
    code: 404,
    message: "No religions found.",
    religions: [],
  };

  try {
    const rows = await db
      .select({ id_ai: gnReligionVariant.idAi, label: gnReligionVariant.label })
      .from(gnReligionVariant)
      .where(eq(gnReligionVariant.status, 1))
      .orderBy(asc(gnReligionVariant.idAi));

    if (Array.isArray(rows) && rows.length > 0) {
      response.code = 200;
      response.message = "ok";
      response.religions = rows.map((row) => ({
        id_ai: Number(row.id_ai),
        label: String(row.label ?? ""),
      }));
    }
  } catch (error) {
    tools.serverLog(`Error in getReligions: ${error}`, "getReligions-100");
    response.code = 500;
    response.message = "Internal server error";
  }

  return response;
}
