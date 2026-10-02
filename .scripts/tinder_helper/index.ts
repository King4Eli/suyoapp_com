/**
 * Tinder scraper
 * ──────────────
 * Pulls recommendations from Tinder's /v2/recs/core endpoint and upserts
 * them into the local `users`, `users_interests`, and `users_prompt` tables.
 *
 * Fields Tinder does not provide are filled with random, plausible values
 * so every NOT NULL constraint is satisfied.
 *
 * Circuit breaker: aborts the whole scrape if photo uploads fail
 * MAX_UPLOAD_FAILURES times in a row.
 *
 * Usage:
 *   bun run .scripts/tinder_helper/index.ts --dry-run
 */

import * as schema from "../../api/db/schema.js";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";

// Load helper credentials and the API database settings before importing the DB client.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(SCRIPT_DIR, ".env"));
loadEnvFile(join(SCRIPT_DIR, "../../.env/db.env"));
const { db } = await import("../../api/db/client.js");

const {
  users,
  usersInterests,
  usersPrompt,
  gnInterestsVariant,
  gnPromptsVariant,
} = schema;

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_TOKEN      = "229f3903-9edc-4a2f-b325-477636786562";
const DEVICE_ID       = "e3d342a9-4252-4ea7-9779-037842d01955";
const CLIENT_SESSION  = process.env.TINDER_CLIENT_SESSION  ?? "";
const USER_SESSION_ID = process.env.TINDER_USER_SESSION_ID ?? randomUUID();
const APP_SESSION_ID  = process.env.TINDER_APP_SESSION_ID  ?? randomUUID();

const LOOP_ITERATION_PULL = Number("1");
const MIN_USER_PHOTOS = 2;
const MAX_USER_PHOTOS = 6;
const MAX_UPLOAD_FAILURES = Number("3");

if (!AUTH_TOKEN || !DEVICE_ID) {
  console.error("Missing TINDER_AUTH_TOKEN or TINDER_DEVICE_ID");
  process.exit(1);
}

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");

const SAVED_USERS_PATH = ".saveduser.json";

// ─── Circuit breaker state ──────────────────────────────────────────────────
// Aborts the whole scrape once consecutive photo-upload failures hit
// MAX_UPLOAD_FAILURES. Reset on any success.
let consecutiveUploadFailures = 0;
let abortScrape = false;

// ─────────────────────────────────────────────────────────────────────────────
// Tinder fetch
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRecs(): Promise<any[]> {
  const res = await fetch(
    "https://api.gotinder.com/v2/recs/core?locale=en&duos=0",
    {
      headers: {
        Host: "api.gotinder.com",
        "Persistent-Device-Id": DEVICE_ID!,
        "Sec-Ch-Ua-Platform": '"Linux"',
        "Sec-Ch-Ua": '"Chromium";v="151", "Not=A?Brand";v="99"',
        "X-Supported-Image-Formats": "webp,jpeg",
        "X-Client-Session": CLIENT_SESSION,
        "Tinder-Version": "7.36.2",
        "Sec-Ch-Ua-Mobile": "?0",
        "App-Version": "1073602",
        Accept: "application/json",
        Platform: "web",
        "User-Session-Id": USER_SESSION_ID,
        "X-Auth-Token": AUTH_TOKEN!,
        "Accept-Language": "en,en-US",
        "Support-Short-Video": "1",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
        "App-Session-Id": APP_SESSION_ID,
        Origin: "https://tinder.com",
        Referer: "https://tinder.com/",
      },
    },
  );
  if (!res.ok) throw new Error(`Tinder HTTP ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  return (json?.data?.results ?? [])
    .filter((r: any) => r.type === "user" && r.user)
    .map((r: any) => r.user);
}

// ─────────────────────────────────────────────────────────────────────────────
// Random helpers for Tinder-less fields
// ─────────────────────────────────────────────────────────────────────────────

const rnd = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rint = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function randomPhone(): string {
  return `+1${rint(200, 999)}${rint(100, 999)}${rint(1000, 9999)}`;
}

const BASE_GEO = { lat: 29.9511, lng: -90.0715 };

function randomGeo(base = BASE_GEO) {
  const lat = base.lat + (Math.random() - 0.5) * 0.5;
  const lng = base.lng + (Math.random() - 0.5) * 0.5;
  const alphabet = "0123456789bcdefghjkmnpqrstuvwxyz";
  let hash = "";
  for (let i = 0; i < 12; i++) hash += alphabet[rint(0, 31)];
  return { lat, lng, hash };
}

function randomDeviceStats(): string {
  return JSON.stringify({
    os: rnd(["iOS_17.4", "Android_14", "iOS_18.1", "Android_15"]),
    model: rnd(["iPhone 15 Pro", "Pixel 8", "Galaxy S24", "iPhone 14"]),
    app_version: rnd(["7.36.2", "7.35.0", "7.34.1"]),
    is_emulator: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo upload
// ─────────────────────────────────────────────────────────────────────────────

// Fetch a Tinder photo, ask the API for a presigned upload URL, then PUT the bytes.
async function uploadProfilePhoto(photoUrl: string): Promise<string> {
  const sourceResponse = await fetch(photoUrl);
  if (!sourceResponse.ok) {
    throw new Error(`photo fetch failed (HTTP ${sourceResponse.status})`);
  }

  const contentType = (sourceResponse.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
  };
  const extension = extensionByMime[contentType];
  if (!extension) {
    throw new Error(`unsupported photo content type: ${contentType || "unknown"}`);
  }

  const photo = await sourceResponse.arrayBuffer();
  if (photo.byteLength === 0 || photo.byteLength > 10 * 1024 * 1024) {
    throw new Error(`photo size is invalid (${photo.byteLength} bytes)`);
  }

  const apiDomain = (process.env.SUYO_API_DOMAIN ?? "https://api.suyoapp.com")
    .replace(/\/+$/, "");
  const presignResponse = await fetch(
    `${apiDomain}/api/core/v1/handleFileUpload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        meta: { extension, bucketType: "signup-void", fileSize: photo.byteLength },
      }),
    },
  );
  if (!presignResponse.ok) {
    throw new Error(`presign request failed (HTTP ${presignResponse.status})`);
  }
  const presignResult = await presignResponse.json();
  const presigned = presignResult?.data;
  if (presignResult?.code !== 200 || !presigned?.uploadUrl) {
    throw new Error(
      presignResult?.message ?? "presign response did not include an upload URL",
    );
  }

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: presigned.method ?? "PUT",
    headers: {
      "Content-Type": contentType,
      ...(presigned.uploadHeaders ?? {}),
    },
    body: photo,
  });
  if (!uploadResponse.ok) {
    throw new Error(`photo upload failed (HTTP ${uploadResponse.status})`);
  }

  const objectPath =
    presigned.objectPath ?? (presigned.fileKey ? `/${presigned.fileKey}` : null);
  if (!objectPath) throw new Error("presign response did not include an object path");
  return objectPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Coerce possibly-nested string-ish values (jobs/schools) into a string. */
function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const anyV = v as Record<string, unknown>;
    // Tinder often nests the human-readable value under `.name`
    if (typeof anyV.name === "string") return anyV.name;
  }
  return null;
}

function descriptorValue(user: any, name: string): any {
  const d = (user.selected_descriptors ?? []).find(
    (x: any) => x.name === name,
  );
  if (!d) return undefined;
  if (d.type === "measurement") return d.measurable_selection?.value;
  return d.choice_selections?.[0]?.name;
}

function mapGender(g: number | undefined): number {
  if (g === 0 || g === 1) return g;
  return -1;
}

function mapEducation(name?: string): number | null {
  if (!name) return null;
  const map: Record<string, number> = {
    "High School": 1,
    "Trade School": 7,
    Bachelors: 2,
    Masters: 3,
    PhD: 4,
  };
  return map[name] ?? null;
}

function mapDrinking(name?: string): "0" | "1" | "2" {
  if (!name) return "1";
  if (/never/i.test(name)) return "0";
  if (/social/i.test(name)) return "1";
  if (/often|frequent/i.test(name)) return "2";
  return "1";
}

function mapSmoking(name?: string): "0" | "1" | "2" {
  if (!name) return "0";
  if (/never|non/i.test(name)) return "0";
  if (/social/i.test(name)) return "1";
  if (/regular|chain|often/i.test(name)) return "2";
  return "0";
}

function mapUser(u: any, uploadedPhotoPaths: string[] = []) {
  const geo = randomGeo();
  const dob = new Date(u.birth_date);
  const dobStr =
    `${dob.getUTCFullYear()}` +
    `${String(dob.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(dob.getUTCDate()).padStart(2, "0")}`;

  const bio = (u.bio ?? "").slice(0, 400);
  const school = asString(u.schools?.[0]?.name)?.slice(0, 50) ?? null;
  const job    = asString(u.jobs?.[0]?.title)?.slice(0, 20) ?? null;

  const height = descriptorValue(u, "Height");
  const education = mapEducation(descriptorValue(u, "Education"));
  const drinking = mapDrinking(descriptorValue(u, "Drinking"));
  const smoking = mapSmoking(descriptorValue(u, "Smoking"));
  const childrenVal = descriptorValue(u, "Family Plans");
  const children: "0" | "1" =
    childrenVal && /don'?t want/i.test(childrenVal) ? "1" : "0";
  const hasPet: "0" | "1" = descriptorValue(u, "Pets") ? "1" : "0";

  return {
    userId: u._id,
    userEmail: null,
    userPhonenumber: randomPhone(),
    userPhonenumberMeta: null,
    userFullname: u.name ?? "Unknown",
    userImage: JSON.stringify(uploadedPhotoPaths.map((p, o) => ({ p, o }))),
    userActive: "1" as const,
    userDeletedDate: null,
    userDeleteData: null,
    geoMeta: { display_name: u.city?.name ?? "Unknown" },
    geoHash: geo.hash,
    geoLong: geo.lng,
    geoLatd: geo.lat,
    userVerified: u.badges?.some((b: any) => b.type === "selfie_verified")
      ? ("1" as const)
      : ("0" as const),
    userSignedupDeviceStats: randomDeviceStats(),
    userBioHighesteducation: education,
    userBioRelationshipgoal: null,
    userBioSchoolattended: school,
    userBioPoliticalview: null,
    userBioHometown: null,
    userBioLanguage: null,
    userBioCompany: job,
    userBioEthnicity: null,
    userBioSmoking: smoking,
    userBioDrinking: drinking,
    userBioChildren: children,
    userBioReligion: null,
    userBioJobrole: job,
    userBioGender: mapGender(u.gender),
    userBioHaspet: hasPet,
    userBioAbout: bio,
    userBioHeight: typeof height === "number" ? height : null,
    userBioDob: dobStr,
    userBioSocialLinks: null,
  };
}

function mapInterests(u: any) {
  const raw = u.experiment_info?.user_interests?.selected_interests ?? [];
  return raw.map((i: any) => ({
    id: i.id as string,
    name: i.name as string,
    emoji: (i.emoji ?? "") as string,
  }));
}

function mapPrompts(u: any) {
  const raw = u.user_prompts?.prompts ?? [];
  return raw.map((p: any) => ({
    id: p.id as string,
    question: p.question_text as string,
    answer: p.answer_text as string,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant upserts
// ─────────────────────────────────────────────────────────────────────────────

async function ensureInterestVariant(interest: {
  id: string;
  name: string;
}): Promise<number> {
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

async function ensurePromptVariant(prompt: { question: string }): Promise<number> {
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

// ─────────────────────────────────────────────────────────────────────────────
// Upsert
// ─────────────────────────────────────────────────────────────────────────────

async function upsertUser(u: any, uploadedPhotoPaths: string[]) {
  const row = mapUser(u, uploadedPhotoPaths);

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

  for (const it of mapInterests(u)) {
    const variantId = await ensureInterestVariant(it);
    const dupe = await db
      .select()
      .from(usersInterests)
      .where(
        sql`${usersInterests.userId} = ${row.userId}
            AND ${usersInterests.interestsVariantRefId} = ${variantId}`,
      )
      .limit(1);
    if (dupe.length) continue;
    await db
      .insert(usersInterests)
      .values({ userId: row.userId, interestsVariantRefId: variantId });
  }

  for (const p of mapPrompts(u)) {
    const variantId = await ensurePromptVariant(p);
    const answer = p.answer.slice(0, 100);
    const dupe = await db
      .select()
      .from(usersPrompt)
      .where(
        sql`${usersPrompt.userId} = ${row.userId}
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
        .values({ userId: row.userId, promptsVariantRefId: variantId, answer });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// saveduser.json helpers
// ─────────────────────────────────────────────────────────────────────────────

async function loadSavedUsers(): Promise<Set<string>> {
  try {
    const raw = await readFile(SAVED_USERS_PATH, "utf8");
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function saveSavedUsers(ids: Set<string>) {
  await writeFile(SAVED_USERS_PATH, JSON.stringify([...ids], null, 2), "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const saved = await loadSavedUsers();
  console.log(`loaded ${saved.size} previously-saved user ids`);

  let processed = 0;
  let skipped = 0;

  for (let run = 1; run <= LOOP_ITERATION_PULL; run++) {
    if (abortScrape) break;
    console.log(`\n▶ Pull ${run}/${LOOP_ITERATION_PULL}`);
    let recs: any[];
    try {
      recs = await fetchRecs();
    } catch (e) {
      console.error(`  fetch failed: ${(e as Error).message}`);
      continue;
    }
    console.log(`  fetched ${recs.length} users`);

    for (const u of recs) {
      if (abortScrape) break;

      if (saved.has(u._id)) {
        console.log(`  ↷ ${u.name} (already saved)`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.dir(
          {
            user: mapUser(u),
            //interests: mapInterests(u),
            //prompts: mapPrompts(u),
          },
          { depth: null },
        );
        continue;
      }

      let uploadedPhotoPaths: string[];
      try {
        const photoUrls = (u.photos ?? [])
          .map((photo: any) => photo?.url)
          .filter(
            (url: unknown): url is string =>
              typeof url === "string" && url.length > 0,
          )
          .slice(0, MAX_USER_PHOTOS);
        if (photoUrls.length < MIN_USER_PHOTOS) {
          throw new Error(
            `profile has ${photoUrls.length} photos; at least ${MIN_USER_PHOTOS} are required`,
          );
        }

        uploadedPhotoPaths = [];
        for (const photoUrl of photoUrls) {
          uploadedPhotoPaths.push(await uploadProfilePhoto(photoUrl));
        }

        // Success — reset the circuit breaker.
        consecutiveUploadFailures = 0;
      } catch (e) {
        consecutiveUploadFailures++;
        console.error(
          `  ✗ photo upload failed for ${u.name}; user skipped: ${(e as Error).message}`,
        );
        console.error(
          `    upload failures: ${consecutiveUploadFailures}/${MAX_UPLOAD_FAILURES}`,
        );
        skipped++;

        if (consecutiveUploadFailures >= MAX_UPLOAD_FAILURES) {
          abortScrape = true;
          console.error(
            `\n✖ Aborting: ${MAX_UPLOAD_FAILURES} consecutive photo-upload failures`,
          );
          break;
        }
        continue;
      }

      try {
        await upsertUser(u, uploadedPhotoPaths);
        saved.add(u._id);
        processed++;
        console.log(`  ✓ ${u.name} (${u._id})`);
      } catch (e) {
        console.error(
          `  ✗ db write failed for ${u.name}: ${(e as Error).message}`,
        );
      }
    }

    // Persist progress after each page so a crash doesn't lose work.
    if (!DRY_RUN) await saveSavedUsers(saved);
  }

  if (!DRY_RUN) await saveSavedUsers(saved);

  console.log(
    `\nDone. processed=${processed} skipped=${skipped} ` +
      `total_saved=${saved.size} aborted=${abortScrape}`,
  );
  process.exit(abortScrape ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});