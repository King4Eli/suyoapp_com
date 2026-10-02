// Discovery (ranking, filters), likes, matching, chat and messages.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { core, createUser, query, resetData, setPlan } from "./helpers.js";

beforeEach(resetData);

const ids = (/** @type {any} */ res) =>
  (res.matchespeoples ?? []).map((/** @type {any} */ p) => p.user_id);

/** Points roughly `miles` north of San Francisco. @param {number} miles */
const north = (miles) => ({ latd: 37.7749 + miles / 69, long: -122.4194 });

// ── Discovery ───────────────────────────────────────────────────────────────

test("discovery: ranks boosted, then recently active, then nearest", async () => {
  const viewer = await createUser({ name: "Viewer" });
  const farActive = await createUser({
    name: "FarActive",
    ...north(20),
    lastActiveDaysAgo: 0,
  });
  const nearActive = await createUser({
    name: "NearActive",
    ...north(2),
    lastActiveDaysAgo: 0,
  });
  const nearDormant = await createUser({
    name: "NearDormant",
    ...north(1),
    lastActiveDaysAgo: 30,
  });
  const boostedFar = await createUser({
    name: "BoostedFar",
    ...north(30),
    lastActiveDaysAgo: 30,
  });
  await query(
    "UPDATE users SET user_boosted_until = NOW() + INTERVAL 30 MINUTE WHERE user_id = ?",
    [boostedFar.id],
  );

  const res = await core("getPeopleToMatch", {}, viewer);
  assert.equal(res.code, 200);
  assert.deepEqual(ids(res), [
    boostedFar.id,
    nearActive.id,
    farActive.id,
    nearDormant.id,
  ]);
});

test("discovery: an expired boost no longer ranks first", async () => {
  const viewer = await createUser();
  const near = await createUser({ ...north(1), lastActiveDaysAgo: 0 });
  const expired = await createUser({ ...north(10), lastActiveDaysAgo: 0 });
  await query(
    "UPDATE users SET user_boosted_until = NOW() - INTERVAL 1 MINUTE WHERE user_id = ?",
    [expired.id],
  );
  const res = await core("getPeopleToMatch", {}, viewer);
  assert.deepEqual(ids(res), [near.id, expired.id]);
});

test("discovery: excludes self, incognito, inactive, out of range and already swiped", async () => {
  const viewer = await createUser();
  const visible = await createUser();
  await createUser({ incognito: true });
  await createUser({ active: "3" });
  await createUser({ ...north(500) });
  const passed = await createUser();
  await core(
    "pushPeopleToMatch",
    { user_id2: passed.id, match_status: 2 },
    viewer,
  );

  const res = await core("getPeopleToMatch", {}, viewer);
  assert.deepEqual(ids(res), [visible.id]);
});

test("discovery: respects the viewer's gender preference", async () => {
  const viewer = await createUser({ interestedIn: 2 });
  const women = await createUser({ gender: 2 });
  await createUser({ gender: 1 });
  const res = await core("getPeopleToMatch", {}, viewer);
  assert.deepEqual(ids(res), [women.id]);
});

test("discovery: hides distance when the person turned it off", async () => {
  const viewer = await createUser();
  await createUser({ showDistance: false });
  const res = await core("getPeopleToMatch", {}, viewer);
  assert.equal(res.matchespeoples[0].distance_miles, undefined);
});

test("discovery: viewing one person by id", async () => {
  const viewer = await createUser();
  const other = await createUser({ name: "Solo" });
  const res = await core(
    "getPeopleToMatch",
    { getOnePersons_id2: other.id },
    viewer,
  );
  assert.equal(res.code, 200);
  assert.equal(res.matchespeoples[0].user_fullname, "Solo");
});

test("viewing user activity updates last-accessed", async () => {
  const user = await createUser({ lastActiveDaysAgo: 10 });
  await core("getProfile", {}, user);
  // touchLastActive is fire-and-forget; give it a moment
  await new Promise((r) => setTimeout(r, 150));
  const [row] = await query(
    "SELECT user_last_accessed > NOW() - INTERVAL 1 MINUTE AS fresh FROM users WHERE user_id = ?",
    [user.id],
  );
  assert.equal(Number(row.fresh), 1);
});

// ── Likes ───────────────────────────────────────────────────────────────────

test("likes: free plan gets anonymous teaser cards only", async () => {
  const me = await createUser();
  const liker = await createUser({ name: "Secret" });
  await core("pushPeopleToMatch", { user_id2: me.id, match_status: 0 }, liker);

  const res = await core("getLikes", {}, me);
  assert.equal(res.code, 200);
  assert.equal(res.locked, true);
  assert.equal(res.likesTotal, 1);
  assert.equal(res.likedlist[0].likedUserId, null);
  assert.equal(res.likedlist[0].likedUserFullname, "");
});

test("likes: Plus sees who liked them, with distance in miles", async () => {
  const me = await createUser();
  await setPlan(me.id, "plus");
  const liker = await createUser({ name: "Nearby", ...north(5) });
  await core("pushPeopleToMatch", { user_id2: me.id, match_status: 0 }, liker);

  const res = await core("getLikes", {}, me);
  assert.equal(res.locked, false);
  const like = res.likedlist[0];
  assert.equal(like.likedUserId, liker.id);
  assert.equal(like.likedUserFullname, "Nearby");
  assert.ok(
    Math.abs(like.distanceMiles - 5) < 0.5,
    `distance ${like.distanceMiles}`,
  );
});

test("likes: distance is withheld when the liker hides it", async () => {
  const me = await createUser();
  await setPlan(me.id, "plus");
  const liker = await createUser({ showDistance: false });
  await core("pushPeopleToMatch", { user_id2: me.id, match_status: 0 }, liker);
  const res = await core("getLikes", {}, me);
  assert.equal(res.likedlist[0].distanceMiles, null);
});

test("likes: superlike needs roses and is flagged", async () => {
  const me = await createUser();
  await setPlan(me.id, "plus");
  const liker = await createUser();
  const sent = await core(
    "pushPeopleToMatch",
    { user_id2: me.id, match_status: 5 },
    liker,
  );
  assert.equal(sent.code, 200, sent.message);
  const res = await core("getLikes", {}, me);
  assert.equal(res.likedlist[0].is_superlike, true);
});

// ── Matching ────────────────────────────────────────────────────────────────

test("matching: liking back makes a match; only the recipient can complete it", async () => {
  const a = await createUser();
  const b = await createUser();
  const like = await core(
    "pushPeopleToMatch",
    { user_id2: b.id, match_status: 0 },
    a,
  );
  assert.equal(like.code, 200);

  const again = await core(
    "pushPeopleToMatch",
    { user_id2: b.id, match_status: 0 },
    a,
  );
  assert.equal(again.code, 409, "the liker can't complete their own like");

  const back = await core(
    "pushPeopleToMatch",
    { user_id2: a.id, match_status: 0 },
    b,
  );
  assert.equal(back.code, 200);
  assert.equal(back.itisamatch, true);
  assert.equal(back.matchId, like.matchId);
});

test("matching: block is final", async () => {
  const a = await createUser();
  const b = await createUser();
  const like = await core(
    "pushPeopleToMatch",
    { user_id2: b.id, match_status: 0 },
    a,
  );
  await core("pushPeopleToMatch", { user_id2: a.id, match_status: 0 }, b);
  const block = await core(
    "pushPeopleToMatch",
    { matchId: like.matchId, match_status: 3 },
    b,
  );
  assert.equal(block.code, 200);
  const reopen = await core(
    "pushPeopleToMatch",
    { matchId: like.matchId, match_status: 0 },
    a,
  );
  assert.equal(reopen.code, 409);
});

test("matching: invalid status and self-match are refused", async () => {
  const a = await createUser();
  assert.equal(
    (await core("pushPeopleToMatch", { user_id2: "x", match_status: 1 }, a))
      .code,
    400,
  );
  assert.equal(
    (await core("pushPeopleToMatch", { user_id2: a.id, match_status: 0 }, a))
      .code,
    400,
  );
});

test("matching: someone else's match id is not found", async () => {
  const a = await createUser();
  const b = await createUser();
  const outsider = await createUser();
  const like = await core(
    "pushPeopleToMatch",
    { user_id2: b.id, match_status: 0 },
    a,
  );
  const res = await core(
    "pushPeopleToMatch",
    { matchId: like.matchId, match_status: 2 },
    outsider,
  );
  assert.equal(res.code, 404);
});

test("rewind: undo a pass on someone who liked you (Plus only)", async () => {
  const me = await createUser();
  const admirer = await createUser();
  const like = await core(
    "pushPeopleToMatch",
    { user_id2: me.id, match_status: 0 },
    admirer,
  );
  await core(
    "pushPeopleToMatch",
    { matchId: like.matchId, match_status: 2 },
    me,
  );

  const free = await core("pushRewindMatch", { matchId: like.matchId }, me);
  assert.equal(free.code, 403);
  assert.equal(free.upgradeRequired, true);

  await setPlan(me.id, "plus");
  const plus = await core("pushRewindMatch", { matchId: like.matchId }, me);
  assert.equal(plus.code, 200, plus.message);
  // their like is pending again, so liking back now makes a match
  const back = await core(
    "pushPeopleToMatch",
    { matchId: like.matchId, match_status: 0 },
    me,
  );
  assert.equal(back.itisamatch, true);
});

test("rewind: a pass you made on a stranger can't be rewound", async () => {
  const me = await createUser();
  await setPlan(me.id, "plus");
  const stranger = await createUser();
  const pass = await core(
    "pushPeopleToMatch",
    { user_id2: stranger.id, match_status: 2 },
    me,
  );
  assert.equal(
    (await core("pushRewindMatch", { matchId: pass.matchId }, me)).code,
    409,
  );
});

// ── Chat & messages ─────────────────────────────────────────────────────────

/** Two users who matched, and their match id. */
async function matched() {
  const a = await createUser({ name: "Ann" });
  const b = await createUser({ name: "Ben" });
  const like = await core(
    "pushPeopleToMatch",
    { user_id2: b.id, match_status: 0 },
    a,
  );
  await core("pushPeopleToMatch", { user_id2: a.id, match_status: 0 }, b);
  return { a, b, matchId: like.matchId };
}

test("messages: send, list, read, and show in chats", async () => {
  const { a, b, matchId } = await matched();
  const sent = await core(
    "pushConversation",
    { match_id: matchId, messagee: "  hi Ben  " },
    a,
  );
  assert.equal(sent.code, 200, sent.message);

  const convo = await core("getConversation", { matchID: matchId }, b);
  assert.equal(convo.code, 200);
  assert.equal(convo.chatsMessageListings.length, 1);
  assert.equal(convo.chatsMessageListings[0].message, "hi Ben");
  assert.equal(convo.chatsMessageListings[0].fromMe, false);

  const chats = await core("getChatLists", {}, a);
  assert.equal(chats.chatsListings.withmessages.length, 1);
  assert.equal(chats.chatsListings.withmessages[0].chat_with_user_id, b.id);
  assert.equal(
    chats.chatsListings.withmessages[0].user_lastmessage.str,
    "hi Ben",
  );
});

test("messages: empty text is refused; outsiders can't read or write", async () => {
  const { a, matchId } = await matched();
  const outsider = await createUser();
  const empty = await core(
    "pushConversation",
    { match_id: matchId, messagee: "   " },
    a,
  );
  assert.notEqual(empty.code, 200);
  assert.equal(
    (
      await core(
        "pushConversation",
        { match_id: matchId, messagee: "hey" },
        outsider,
      )
    ).code,
    404,
  );
  assert.equal(
    (await core("getConversation", { matchID: matchId }, outsider)).code,
    404,
  );
});

test("messages: only the sender can delete, and content is withheld after", async () => {
  const { a, b, matchId } = await matched();
  await core("pushConversation", { match_id: matchId, messagee: "oops" }, a);
  const [msg] = (await core("getConversation", { matchID: matchId }, a))
    .chatsMessageListings;

  assert.equal(
    (await core("pushDeleteMessage", { convoId: msg.messageId }, b)).code,
    403,
  );
  assert.equal(
    (await core("pushDeleteMessage", { convoId: msg.messageId }, a)).code,
    200,
  );

  const [after] = (await core("getConversation", { matchID: matchId }, b))
    .chatsMessageListings;
  assert.equal(after.type, "deleted");
  assert.equal(after.message, null);
});

test("messages: a blocked match can't receive messages", async () => {
  const { a, b, matchId } = await matched();
  await core("pushPeopleToMatch", { matchId, match_status: 3 }, b);
  const res = await core(
    "pushConversation",
    { match_id: matchId, messagee: "still there?" },
    a,
  );
  assert.equal(res.code, 403);
});

test("direct message: sent with a like before matching", async () => {
  const a = await createUser();
  const b = await createUser();
  await setPlan(b.id, "plus");
  const dm = await core(
    "pushDirectMessage",
    { user_id2: b.id, message: "Love your photo" },
    a,
  );
  assert.equal(dm.code, 200, dm.message);
  const likes = await core("getLikes", {}, b);
  assert.equal(likes.likedlist[0].directMessage, "Love your photo");
});

test("direct message: empty message is refused", async () => {
  const a = await createUser();
  const b = await createUser();
  const dm = await core(
    "pushDirectMessage",
    { user_id2: b.id, message: "" },
    a,
  );
  assert.equal(dm.code, 400);
});
