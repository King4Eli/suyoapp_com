import * as schema from "../../../api/db/schema.js";
import { eq, sql } from "drizzle-orm";
import { db } from "./db.ts";
import type { Interest, Prompt, UserRow } from "./UserMapper.ts";

const {
  users,
  usersInterests,
  usersPrompt,
  gnInterestsVariant,
  gnPromptsVariant,
} = schema;

// DB writes for a scraped user: the user row, their interests and prompts.
export class UserRepository {
  async upsertUser(row: UserRow) {
    await db
      .insert(users)
      .values(row)
      .onDuplicateKeyUpdate({
        set: {
          userFullname: row.userFullname,
          userImage: row.userImage,
          userBioAbout: row.userBioAbout,
          userBioHeight: row.userBioHeight,
          userBioDob: row.userBioDob,
          userBioSchoolattended: row.userBioSchoolattended,
          userBioGender: row.userBioGender,
          userBioSmoking: row.userBioSmoking,
          userBioDrinking: row.userBioDrinking,
          userBioChildren: row.userBioChildren,
          userBioHaspet: row.userBioHaspet,
        },
      });
  }

  async addInterests(userId: string, interests: Interest[]) {
    for (const it of interests) {
      const variantId = await this.ensureInterestVariant(it);
      const dupe = await db
        .select()
        .from(usersInterests)
        .where(
          sql`${usersInterests.userId} = ${userId}
              AND ${usersInterests.interestsVariantRefId} = ${variantId}`,
        )
        .limit(1);
      if (dupe.length) continue;
      await db
        .insert(usersInterests)
        .values({ userId, interestsVariantRefId: variantId });
    }
  }

  async upsertPrompts(userId: string, prompts: Prompt[]) {
    for (const p of prompts) {
      const variantId = await this.ensurePromptVariant(p);
      const answer = p.answer.slice(0, 100);
      const dupe = await db
        .select()
        .from(usersPrompt)
        .where(
          sql`${usersPrompt.userId} = ${userId}
              AND ${usersPrompt.promptsVariantRefId} = ${variantId}`,
        )
        .limit(1);
      if (dupe.length) {
        await db
          .update(usersPrompt)
          .set({ answer })
          .where(eq(usersPrompt.idAi, dupe[0].idAi));
      } else {
        await db
          .insert(usersPrompt)
          .values({ userId, promptsVariantRefId: variantId, answer });
      }
    }
  }

  private async ensureInterestVariant(interest: Interest): Promise<number> {
    const existing = await db
      .select()
      .from(gnInterestsVariant)
      .where(eq(gnInterestsVariant.category, interest.id.slice(0, 30)))
      .limit(1);
    if (existing.length) return existing[0].idAi;

    const inserted = await db
      .insert(gnInterestsVariant)
      .values({
        category: interest.id.slice(0, 30),
        interestedIn: interest.name.slice(0, 50),
      })
      .$returningId();
    return inserted[0].idAi;
  }

  private async ensurePromptVariant(prompt: Prompt): Promise<number> {
    const q = prompt.question.slice(0, 255);
    const existing = await db
      .select()
      .from(gnPromptsVariant)
      .where(eq(gnPromptsVariant.question, q))
      .limit(1);
    if (existing.length) return Number(existing[0].idAi);

    const inserted = await db
      .insert(gnPromptsVariant)
      .values({ question: q })
      .$returningId();
    return Number(inserted[0].idAi);
  }
}
