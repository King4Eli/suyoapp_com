import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import {
  refundDirectMessage,
  spendDirectMessage,
} from "../../global/entitlements.js";
import pushPeopleToMatch from "./pushPeopleToMatch.js";
import pushConversation from "./pushConversation.js";

const MAX_DIRECT_MESSAGE_LENGTH = 500;

/**
 * Turns the client's "what I'm commenting on" into a stored reference, checked
 * against the recipient's real profile -- a photo must be one of theirs, and the
 * About text is read from the database, never taken from the client. The result is
 * a snapshot, so the conversation still shows what was commented on if they later
 * edit their profile. Anything that doesn't check out is dropped (the message
 * still sends, just without a quote).
 * @param {string} recipientId
 * @param {any} context { type: "photo", p } | { type: "about" }
 */
async function resolveReplyRef(recipientId, context) {
  const type = context?.type;
  if (type !== "photo" && type !== "about") return null;
  const [row] = await db
    .select({ image: users.userImage, about: users.userBioAbout })
    .from(users)
    .where(eq(users.userId, recipientId))
    .limit(1);
  if (!row) return null;

  if (type === "about") {
    const about = String(row.about ?? "").trim();
    return about ? { k: "about", str: about } : null;
  }
  let photos;
  try {
    photos = JSON.parse(row.image ?? "[]");
  } catch {
    return null;
  }
  const wanted = String(context?.p ?? "");
  const photo = Array.isArray(photos)
    ? photos.find((img) => img?.p && img.p === wanted)
    : null;
  return photo ? { k: "photo", p: photo.p } : null;
}

/**
 * Message someone straight from their profile, before matching. It's a like with a
 * message attached: the like goes through pushPeopleToMatch unchanged (same daily
 * free-tier limit, same transition rules -- liking back someone who liked you makes
 * it a match), and the message is stored on that match's conversation, where the
 * recipient sees it on their Likes card and in the chat once they match.
 * Each one costs a direct message: the plan's daily allowance first, then the
 * purchased balance (entitlements.js). It's spent up front and refunded if the like
 * or the message doesn't go through, so a refused send never costs anything.
 * @param {{ user_id2?: string; matchId?: string; message?: string; context?: any }} data
 * @param {import("socket.io").Server} [io]
 */
export default async function pushDirectMessage(data, io) {
  /** @type {any} */
  const response = { code: 400, message: "Write a message first." };
  try {
    const message = String(data?.message ?? "").trim();
    if (!message) return response;
    if (message.length > MAX_DIRECT_MESSAGE_LENGTH) {
      response.message = `Keep it under ${MAX_DIRECT_MESSAGE_LENGTH} characters.`;
      return response;
    }

    const me = sessions.currentUserID;
    const dm = await spendDirectMessage(me);
    if (!dm.spent) {
      response.code = 402;
      response.outOf = "directMessages";
      response.message =
        "You're out of direct messages for today. Get more to keep messaging.";
      response.directMessagesRemainingToday = 0;
      return response;
    }
    /** Put the direct message back when what it paid for didn't happen. */
    const refund = () =>
      refundDirectMessage(me, dm.source).catch((err) =>
        tools.serverLog(
          `Failed to refund direct message for ${me}: ${err}`,
          "pushDirectMessage-2",
        ),
      );
    const remaining = {
      directMessagesRemainingToday: dm.remainingToday,
      directMessageBalance: dm.balance,
    };

    const liked = await pushPeopleToMatch(
      { user_id2: data?.user_id2, match_status: 0, matchId: data?.matchId },
      io,
    );
    if (liked?.code !== 200 || !liked?.matchId) {
      await refund();
      return liked;
    }

    const replyRef = await resolveReplyRef(liked.otherUserId, data?.context);
    const sent = await pushConversation(
      {
        match_id: liked.matchId,
        messagee: message,
        allowPending: true,
        replyRef,
      },
      io,
    );
    if (sent?.code !== 200) await refund();
    return {
      ...liked,
      ...(sent?.code === 200 ? remaining : {}),
      messageSent: sent?.code === 200,
      message:
        sent?.code === 200
          ? "Message sent with your like."
          : "Liked, but your message couldn't be sent.",
    };
  } catch (err) {
    tools.serverLog(
      `Error in pushDirectMessage: ${err}`,
      "pushDirectMessage-1",
    );
    response.code = 500;
    response.message = "There has been an unrecognized error.";
  }
  return response;
}
