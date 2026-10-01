// Profile, settings (privacy, notifications), reference data, devices,
// locations / travel mode, contact changes and account deletion.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  core,
  createUser,
  lastEmailedCode,
  otpFor,
  post,
  query,
  redisDo,
  namer,
  resetData,
  setPlan,
} from "./helpers.js";

beforeEach(resetData);

test("getProfile returns the account, plan, balances and settings", async () => {
  const user = await createUser({ name: "Pat" });
  const res = await core("getProfile", {}, user);
  assert.equal(res.code, 200);
  const me = res.currentUser;
  assert.equal(me.profile.id, user.id);
  assert.equal(me.profile.fullname, "Pat");
  assert.equal(me.profile.notifications.push, true);
  assert.equal(
    me.profile.notifications.email_promotions,
    false,
    "promotions are opt-in",
  );
  assert.equal(me.boosts.balance, 0);
  assert.equal(me.boosts.weekly, null, "free plan has no weekly boost");
});

test("pushProfile updates bio fields and trims text", async () => {
  const user = await createUser();
  const res = await core(
    "pushProfile",
    { prof_about: "  New bio  ", prof_height: 180, prof_smoking: 1 },
    user,
  );
  assert.equal(res.code, 200, res.message);
  const [row] = await query(
    "SELECT user_bio_about, user_bio_height, user_bio_smoking FROM users WHERE user_id = ?",
    [user.id],
  );
  assert.equal(row.user_bio_about, "New bio");
  assert.equal(Number(row.user_bio_height), 180);
  assert.equal(row.user_bio_smoking, "1");
});

test("pushProfile with nothing to change says so", async () => {
  const user = await createUser();
  const res = await core("pushProfile", {}, user);
  assert.equal(res.code, 203);
});

test("pushProfile ignores an unknown/legacy prof_location field instead of failing", async () => {
  const user = await createUser();
  const res = await core(
    "pushProfile",
    { prof_about: "still saves", prof_location: { city: "X" } },
    user,
  );
  assert.equal(res.code, 200, res.message);
});

test("privacy: read receipts need Plus; other toggles save", async () => {
  const user = await createUser();
  await core(
    "pushProfile",
    { prof_privacy: { showAge: false, readReceipts: true } },
    user,
  );
  let [row] = await query(
    "SELECT user_privacy_show_age a, user_privacy_read_receipts r FROM users WHERE user_id = ?",
    [user.id],
  );
  assert.equal(row.a, "0");
  assert.equal(row.r, "0", "free plan can't turn read receipts on");

  await setPlan(user.id, "plus");
  await core("pushProfile", { prof_privacy: { readReceipts: true } }, user);
  [row] = await query(
    "SELECT user_privacy_read_receipts r FROM users WHERE user_id = ?",
    [user.id],
  );
  assert.equal(row.r, "1");
});

test("notifications: channel and per-category toggles save and read back", async () => {
  const user = await createUser();
  const res = await core(
    "pushProfile",
    {
      prof_notifications: {
        push: false,
        email_likes: false,
        push_promotions: true,
      },
    },
    user,
  );
  assert.equal(res.code, 200, res.message);
  const n = (await core("getProfile", {}, user)).currentUser.profile
    .notifications;
  assert.equal(n.push, false);
  assert.equal(n.email_likes, false);
  assert.equal(n.push_promotions, true);
  assert.equal(
    n.email_matches,
    true,
    "untouched categories keep their defaults",
  );
});

test("notifications: unknown keys are ignored", async () => {
  const user = await createUser();
  const res = await core(
    "pushProfile",
    { prof_notifications: { paused: true } },
    user,
  );
  assert.equal(res.code, 203);
});

test("entitlements follow the plan", async () => {
  const user = await createUser();
  assert.equal((await core("getEntitlement", {}, user)).code, 200);
  await setPlan(user.id, "vip");
  const res = await core("getProfile", {}, user);
  assert.equal(
    res.currentUser.boosts.weekly.available,
    true,
    "VIP includes the weekly boost",
  );
});

test("reference data endpoints answer", async () => {
  const user = await createUser();
  for (const action of [
    "getMapper",
    "getInterests",
    "getPrompts",
    "getReligions",
    "getProducts",
  ]) {
    const res = await core(action, {}, user);
    assert.equal(res.code, 200, `${action}: ${res.message}`);
  }
});

test("products: VIP lists All Plus features first", async () => {
  const user = await createUser();
  const res = await core("getProducts", {}, user);
  const all = JSON.stringify(res);
  assert.ok(
    all.includes("All Plus features"),
    "VIP feature list leads with All Plus features",
  );
});

test("pushDevice registers and refreshes a device", async () => {
  const user = await createUser();
  const device = {
    InstallationId: "dev-1",
    Model: "Pixel",
    Os: "Android_15",
    app_version: "1.0.0",
  };
  assert.equal((await core("pushDevice", { device }, user)).code, 200);
  assert.equal(
    (
      await core(
        "pushDevice",
        { device: { ...device, app_version: "1.1.0" } },
        user,
      )
    ).code,
    200,
  );
  const [row] = await query(
    "SELECT app_version FROM users_devices WHERE device_id = 'dev-1'",
  );
  assert.equal(row.app_version, "1.1.0");
  assert.equal((await core("pushDevice", { device: {} }, user)).code, 400);
});

test("location: pushLocation reverse-geocodes (stubbed) and saves", async () => {
  const user = await createUser();
  const res = await core(
    "pushLocation",
    { longlatd: JSON.stringify({ latd: 34.05, long: -118.24 }) },
    user,
  );
  assert.equal(res.code, 200, res.message);
  const [row] = await query(
    "SELECT geo_latd, geo_long FROM users WHERE user_id = ?",
    [user.id],
  );
  assert.equal(Number(row.geo_latd), 34.05);
});

test("travel mode is VIP only; secondary locations add, list and delete", async () => {
  const user = await createUser();
  assert.equal(
    (await core("pushTravelMode", { enabled: "1" }, user)).code,
    403,
  );
  assert.equal(
    (await core("pushTravelMode", { enabled: true }, user)).code,
    400,
    "only '1' / '0'",
  );
  assert.equal(
    (await core("pushSecondaryLocation", { latd: 40.71, long: -74.0 }, user))
      .code,
    403,
  );

  await setPlan(user.id, "vip");
  assert.equal(
    (await core("pushTravelMode", { enabled: "1" }, user)).code,
    200,
  );
  const added = await core(
    "pushSecondaryLocation",
    { latd: 40.71, long: -74.0 },
    user,
  );
  assert.equal(added.code, 200, added.message);
  assert.equal(
    (await core("pushSecondaryLocation", { latd: 400, long: 0 }, user)).code,
    400,
  );

  const [row] = await query(
    "SELECT id_ai FROM users_locations WHERE user_id = ?",
    [user.id],
  );
  assert.ok(row, "secondary location stored");
  assert.equal((await core("getLocations", {}, user)).code, 200);
  assert.equal(
    (await core("pushDeleteSecondaryLocation", { id: row.id_ai }, user)).code,
    200,
  );
  assert.equal(
    (await core("pushDeleteSecondaryLocation", { id: row.id_ai }, user)).code,
    404,
  );
  // turning travel mode off is always allowed
  assert.equal(
    (await core("pushTravelMode", { enabled: "0" }, user)).code,
    200,
  );
});

test("place search (travel cities) is VIP only and uses the (stubbed) geocoder", async () => {
  const user = await createUser();
  assert.equal(
    (await core("getPlaceSearch", { q: "Testville" }, user)).code,
    403,
  );
  await setPlan(user.id, "vip");
  const res = await core("getPlaceSearch", { q: "Testville" }, user);
  assert.equal(res.code, 200, res.message);
});

test("email change: code is emailed and verified", async () => {
  const user = await createUser({ email: null });
  const ask = await core(
    "pushNewEmail",
    { oldemail: "", newemail: "pat@example.test", rnc: true },
    user,
  );
  assert.equal(ask.code, 200, ask.message);
  const code = lastEmailedCode("pat@example.test");
  assert.ok(code, "code emailed to the new address");
  const done = await core(
    "pushNewEmail",
    { oldemail: "", newemail: "pat@example.test", vcode: code },
    user,
  );
  assert.equal(done.code, 200, done.message);
  const [row] = await query("SELECT user_email FROM users WHERE user_id = ?", [
    user.id,
  ]);
  assert.equal(row.user_email, "pat@example.test");
});

test("email change: a code sent to one address can't verify a different one", async () => {
  const user = await createUser({ email: null });
  await core(
    "pushNewEmail",
    { oldemail: "", newemail: "mine@example.test", rnc: true },
    user,
  );
  const code = lastEmailedCode("mine@example.test");
  const swap = await core(
    "pushNewEmail",
    { oldemail: "", newemail: "victim@example.test", vcode: code },
    user,
  );
  assert.equal(swap.code, 400);
  const [row] = await query("SELECT user_email FROM users WHERE user_id = ?", [
    user.id,
  ]);
  assert.equal(row.user_email, null);
});

test("phone change: a code texted to one number can't verify a different one", async () => {
  const user = await createUser();
  const ask = await core(
    "pushNewPhonenumber",
    { oldpnumber: user.phone, newpnumber: "5559990001", rnc: true },
    user,
  );
  assert.equal(ask.code, 200, ask.message);
  const stored = await redisDo((c) =>
    c.get(`${namer.redis.verifyCode}phone:${user.id}`),
  );
  const code = String(stored).split(":")[0];

  const swap = await core(
    "pushNewPhonenumber",
    { oldpnumber: user.phone, newpnumber: "5559990002", vcode: code },
    user,
  );
  assert.equal(swap.code, 400);
  const ok = await core(
    "pushNewPhonenumber",
    { oldpnumber: user.phone, newpnumber: "5559990001", vcode: code },
    user,
  );
  assert.equal(ok.code, 200, ok.message);
});

test("account deletion soft-deletes, frees the number and ends discovery", async () => {
  const user = await createUser();
  const viewer = await createUser();
  const res = await core("pushDeleteAccount", { reason: "testing" }, user);
  assert.equal(res.code, 200, res.message);
  const [row] = await query("SELECT user_active FROM users WHERE user_id = ?", [
    user.id,
  ]);
  assert.equal(row.user_active, "-99");

  const people = await core("getPeopleToMatch", {}, viewer);
  assert.ok(
    !(people.matchespeoples ?? []).some(
      (/** @type {any} */ p) => p.user_id === user.id,
    ),
  );

  // the number can sign up again
  const again = await post("/api/signup", { user_phone: user.phone, cc: "1" });
  assert.equal(again.json.code, 200, again.json.message);
  assert.ok(await otpFor(user.phone));
});
