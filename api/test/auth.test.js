// Health check, login / signup (OTP) and the session guard on core actions.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  core,
  createUser,
  get,
  otpFor,
  post,
  query,
  resetData,
} from "./helpers.js";

beforeEach(resetData);

test("status endpoint answers and stamps the API build", async () => {
  const res = await get("/s");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-api-build"), "test");
});

test("unknown routes return 404", async () => {
  const res = await get("/nope");
  assert.equal(res.status, 404);
});

test("core actions need a session token", async () => {
  const missing = await post("/api/core/v1/getProfile");
  assert.equal(missing.status, 400);
  const forged = await post("/api/core/v1/getProfile", {}, "not-a-jwt");
  assert.equal(forged.status, 401);
});

test("unknown core action is rejected", async () => {
  const user = await createUser();
  const res = await post("/api/core/v1/doesNotExist", {}, user.token);
  assert.equal(res.status, 400);
  assert.equal(res.json.message, "unresolved use case");
});

test("login: unknown number is sent to signup", async () => {
  const res = await post("/api/login", { user_phone: "5550009999", cc: "1" });
  assert.equal(res.json.code, 404);
  assert.equal(res.json.to, "signup");
});

test("login: OTP round trip issues a working session", async () => {
  const user = await createUser({ phone: "5551230001" });
  const ask = await post("/api/login", { user_phone: user.phone, cc: "1" });
  assert.equal(ask.json.code, 200);

  const code = await otpFor(user.phone);
  assert.match(String(code), /^\d{6}$/);

  const wrong = await post("/api/login", {
    user_phone: user.phone,
    cc: "1",
    vcode: "000000" === code ? "111111" : "000000",
  });
  assert.equal(wrong.json.code, 404);

  const ok = await post("/api/login", {
    user_phone: user.phone,
    cc: "1",
    vcode: code,
  });
  assert.equal(ok.json.code, 200);
  const token = ok.headers.get("x-omi-auth");
  assert.ok(token, "session token returned in x-omi-auth");

  const profile = await core("getProfile", {}, token);
  assert.equal(profile.code, 200);
  assert.equal(profile.currentUser.profile.id, user.id);
});

test("login: a code works only once", async () => {
  const user = await createUser({ phone: "5551230002" });
  await post("/api/login", { user_phone: user.phone, cc: "1" });
  const code = await otpFor(user.phone);
  const first = await post("/api/login", {
    user_phone: user.phone,
    cc: "1",
    vcode: code,
  });
  assert.equal(first.json.code, 200);
  const replay = await post("/api/login", {
    user_phone: user.phone,
    cc: "1",
    vcode: code,
  });
  assert.equal(replay.json.code, 404);
});

test("signup: OTP then profile creates an account", async () => {
  const phone = "5551239999";
  const ask = await post("/api/signup", { user_phone: phone, cc: "1" });
  assert.equal(ask.json.code, 200);
  const code = await otpFor(phone);

  const created = await post("/api/signup", {
    user_phone: phone,
    cc: "1",
    vcode: code,
    first_name: "Newbie",
    birthday: "1995-04-02",
    gender: 2,
    interested_in: 1,
    location: { latd: 37.77, long: -122.41 },
  });
  assert.equal(created.json.code, 200, JSON.stringify(created.json));
  const [row] = await query(
    "SELECT user_fullname, user_bio_dob, user_active FROM users WHERE user_phonenumber = ?",
    [phone],
  );
  assert.equal(row.user_fullname, "Newbie");
  assert.equal(row.user_bio_dob, "19950402");
  assert.equal(row.user_active, "1");
});

test("signup: an existing number can't sign up again", async () => {
  const user = await createUser({ phone: "5551238888" });
  const res = await post("/api/signup", { user_phone: user.phone, cc: "1" });
  assert.equal(res.json.code, 409);
});

test("signup: missing name or birthday is refused", async () => {
  const phone = "5551237777";
  await post("/api/signup", { user_phone: phone, cc: "1" });
  const code = await otpFor(phone);
  const res = await post("/api/signup", {
    user_phone: phone,
    cc: "1",
    vcode: code,
    first_name: "",
  });
  assert.equal(res.json.code, 400);
});
