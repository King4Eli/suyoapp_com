// Shared harness for the API tests (test/*.test.js, run by `npm test`).
//
// Each test file runs in its own process against the throwaway MySQL/Redis in
// test/docker-compose.yml (env: test/test.env). Importing this file:
//   1. blocks outbound network -- the SMS gateway, Nominatim, s3bender and
//      anything else get canned replies, recorded in `outbound`;
//   2. starts the real Express app (app.js) on a random local port.
// Then `resetData()` wipes user data, and the fixtures below build users,
// plans and balances directly in the database.

import { after } from "node:test";
import ngeohash from "ngeohash";

/** @type {{ url: string; body: any }[]} every blocked outbound request */
export const outbound = [];

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input?.url ?? input);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    return realFetch(input, init);
  }
  outbound.push({ url, body: init?.body });
  if (url.includes("nominatim")) {
    const place = {
      display_name: "Testville, California, United States",
      lat: "37.7749",
      lon: "-122.4194",
      address: {
        city: "Testville",
        state: "California",
        country: "United States",
      },
    };
    return Response.json(url.includes("/search") ? [place] : place);
  }
  if (url.includes("sms.")) return new Response("queued", { status: 200 });
  if (url.includes("s3.test.invalid") && url.endsWith("/presign")) {
    const { key, method } = JSON.parse(String(init?.body ?? "{}"));
    return Response.json({
      url: `http://s3.test.invalid/upload/${key}?sig=test`,
      method,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });
  }
  return new Response("outbound network is blocked in tests", { status: 503 });
};

const { httpServer, io } = await import("../app.js");

// Email: record instead of sending (there's no SMTP in tests). Tests read the
// codes the API would have emailed from `mailbox`.
/** @type {{ to: string; subject: string; html: string; text: string }[]} */
export const mailbox = [];
const { communicateWith } = await import("../global/sendingCommunicate.js");
communicateWith.sendEmail = async (_from, to, subject, html, text) => {
  mailbox.push({ to, subject, html, text });
  return { code: 200, message: "recorded by tests" };
};

/** The last 6-digit code emailed to `to`. @param {string} to */
export function lastEmailedCode(to) {
  const mail = [...mailbox].reverse().find((m) => m.to === to);
  return mail
    ? (String(mail.text ?? mail.html).match(/\b(\d{6})\b/)?.[1] ?? null)
    : null;
}
const { db, pool } = await import("../db/client.js");
const { sessions } = await import("../global/sessions.js");
const { redisDo } = await import("../global/redisClient.js");
const { namer } = await import("../global/namer.js");
const schema = await import("../db/schema.js");
export { db, schema, namer, redisDo };

await new Promise((resolve) =>
  httpServer.listen(0, "127.0.0.1", () => resolve(undefined)),
);
const address = /** @type {import("node:net").AddressInfo} */ (
  httpServer.address()
);
export const baseUrl = `http://127.0.0.1:${address.port}`;

after(async () => {
  io.close();
  await new Promise((resolve) => httpServer.close(() => resolve(undefined)));
  await pool.end();
});

// ── HTTP ──────────────────────────────────────────────────────────────────

/**
 * POST JSON to any API path.
 * @param {string} path
 * @param {any} [body]
 * @param {string} [token] x-omi-auth session token
 */
export async function post(path, body = {}, token) {
  const res = await realFetch(baseUrl + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-omi-auth": token } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON (e.g. the 404 page)
  }
  return { status: res.status, json, text, headers: res.headers };
}

/** GET any API path. @param {string} path */
export async function get(path) {
  const res = await realFetch(baseUrl + path);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, json, text, headers: res.headers };
}

/**
 * Calls a core action (/api/core/v1/:action) as `user`.
 * @param {string} action
 * @param {any} [body]
 * @param {{ token: string } | string | null} [user] a fixture user, a token, or none
 */
export async function core(action, body = {}, user = null) {
  const token = typeof user === "string" ? user : user?.token;
  const res = await post(`/api/core/v1/${action}`, body, token);
  return res.json ?? res;
}

// ── Database ──────────────────────────────────────────────────────────────

// Everything users create; reference data (gn_*, products, mapping) is kept.
const USER_TABLES = [
  "users",
  "users_devices",
  "users_interests",
  "users_locations",
  "users_prompt",
  "users_reported",
  "matches",
  "conversations",
  "feed_posts",
  "feed_reactions",
  "feed_comments",
  "logs_application",
  "payments",
  "subscriptions",
  "iap_transactions",
  "stripe_events",
  "user_boost_usage",
  "user_direct_message_usage",
  "user_rose_usage",
  "user_payment_notices",
  "user_verifications",
];

/** Empties every user-data table and Redis (codes, rate limits, caches). */
export async function resetData() {
  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of USER_TABLES)
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    conn.release();
  }
  await redisDo((client) => client.flushDb());
  outbound.length = 0;
  mailbox.length = 0;
}

/** Runs raw SQL against the test database. @param {string} sqlText @param {any[]} [params] */
export async function query(sqlText, params = []) {
  const [rows] = await pool.query(sqlText, params);
  return /** @type {any} */ (rows);
}

// ── Fixtures ──────────────────────────────────────────────────────────────

let seq = 0;
const SF = { latd: 37.7749, long: -122.4194 };

/**
 * Inserts an active user and returns { id, token, phone }. Defaults: a
 * 30-year-old in San Francisco, gender 1, open to everyone, all ages.
 * @param {{
 *   name?: string; age?: number; gender?: number; interestedIn?: number;
 *   latd?: number; long?: number; phone?: string; email?: string | null;
 *   active?: string; incognito?: boolean; showDistance?: boolean;
 *   lastActiveDaysAgo?: number; extra?: Record<string, any>;
 * }} [opts]
 */
export async function createUser(opts = {}) {
  seq += 1;
  const id = `test_user_${process.pid}_${seq}`;
  const phone =
    opts.phone ??
    `555${String(process.pid).slice(-3)}${String(seq).padStart(4, "0")}`;
  const latd = opts.latd ?? SF.latd;
  const long = opts.long ?? SF.long;
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - (opts.age ?? 30));
  dob.setMonth(0, 1);
  const dobStr = dob.toISOString().slice(0, 10).replace(/-/g, "");

  await db.insert(schema.users).values({
    userId: id,
    userPhonenumber: phone,
    userEmail: opts.email === undefined ? `${id}@example.test` : opts.email,
    userFullname: opts.name ?? `Tester ${seq}`,
    userImage: JSON.stringify([
      { p: `/users/${id}/profile_media/1.jpg`, o: 0 },
    ]),
    userActive: /** @type {any} */ (opts.active ?? "1"),
    userVerified: "0",
    geoMeta: {
      city: "San Francisco",
      state: "California",
      country: "United States",
      latd,
      long,
    },
    geoHash: ngeohash.encode(latd, long, 12),
    geoLatd: latd,
    geoLong: long,
    userSignedupDeviceStats: "{}",
    userBioGender: opts.gender ?? 1,
    userBioAbout: "Hello from the API tests",
    userBioDob: dobStr,
    userBioSmoking: "0",
    userBioDrinking: "0",
    userBioChildren: "0",
    userBioHaspet: "0",
    userPreferenceGender: opts.interestedIn ?? -99,
    userPreferenceMinimumAge: 18,
    userPreferenceMaximumAge: 99,
    userPreferenceDistance: 50,
    userPrivacyIncognito: opts.incognito ? "1" : "0",
    userPrivacyShowDistance: opts.showDistance === false ? "0" : "1",
    ...(opts.extra ?? {}),
  });
  if (opts.lastActiveDaysAgo !== undefined) {
    await query(
      "UPDATE users SET user_last_accessed = NOW() - INTERVAL ? DAY WHERE user_id = ?",
      [opts.lastActiveDaysAgo, id],
    );
  }
  return { id, phone, token: sessions.createSession(id) };
}

/**
 * Gives `userId` an active subscription to the seeded plus/vip plan.
 * @param {string} userId
 * @param {"plus" | "vip"} tier
 */
export async function setPlan(userId, tier) {
  const [variant] = await query(
    `SELECT v.id_ai FROM product_list_variant v
       JOIN product_lists p ON p.pl_sku = v.product_lists_id_ref
     WHERE p.category = 'mainsub' AND p.tier = ? ORDER BY v.id_ai LIMIT 1`,
    [tier],
  );
  await db.insert(schema.subscriptions).values({
    id: `sub_${userId}_${tier}`,
    userId,
    variantIdRef: variant.id_ai,
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    externalPlatform: 1,
    externalId: `test_${userId}`,
    status: 1,
  });
}

/** @param {string} userId @param {number} boosts */
export async function giveBoosts(userId, boosts) {
  await query(
    "INSERT INTO user_boost_usage (user_id, boost_balance) VALUES (?, ?) ON DUPLICATE KEY UPDATE boost_balance = ?",
    [userId, boosts, boosts],
  );
}

/** The OTP the API stored for `phone` (what the SMS would have said). @param {string} phone */
export async function otpFor(phone) {
  return redisDo((client) => client.get(`${namer.redis.verifyCode}${phone}`));
}
