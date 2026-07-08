import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { gnPromptsVariant } from "../../db/schema.js";
import { tools } from "../../global/functions.js";

export default async function getPrompts(/** @type {any} */ params) {
  /** @type { any } */
  const response = {
    code: 404,
    message: "No prompts found.",
    prompts: [],
  };

  const excludeIds = Array.isArray(params?.excludeIds)
    ? params.excludeIds
        .filter((/** @type {any} */ id) => Number.isFinite(Number(id)))
        .map(Number)
    : [];

  try {
    const rows = await db
      .select({
        id_ai: gnPromptsVariant.idAi,
        question: gnPromptsVariant.question,
      })
      .from(gnPromptsVariant)
      .where(
        and(
          eq(gnPromptsVariant.status, 1),
          excludeIds.length > 0
            ? notInArray(gnPromptsVariant.idAi, excludeIds)
            : undefined,
        ),
      )
      .orderBy(sql`rand()`)
      .limit(16);

    if (Array.isArray(rows) && rows.length > 0) {
      response.code = 200;
      response.message = "ok";
      response.prompts = rows.map((row) => ({
        id_ai: Number(row.id_ai),
        question: String(row.question ?? ""),
      }));
    }
  } catch (error) {
    tools.serverLog(`Error in getPrompts: ${error}`, "getPrompts-100");
    response.code = 500;
    response.message = "Internal server error";
  }

  return response;
}
