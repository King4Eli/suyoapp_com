import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { subscriptions, users } from "../../db/schema.js";
import { stripe_gateway, tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * Soft-deletes the current user: user_active = -99, stamps user_deleted_date
 * (unix seconds) and moves the phone number into user_delete_data. Clearing
 * user_phonenumber frees the number -- signup and pushNewPhonenumber only
 * reject numbers that still exist in users, so it can register again.
 * Any live Stripe subscription is cancelled first, so a deleted account is never
 * billed again; if Stripe can't be reached the deletion stops and says so.
 * App Store / Google Play plans can't be cancelled from here -- the app warns the
 * user to cancel those in the store.
 * @param {{ reason?: string }} data
 */
export default async function pushDeleteAccount(data) {
  /** @type {any} */
  const response = { code: 404, message: "Account not found." };

  try {
    const reason = String(data?.reason ?? "")
      .trim()
      .slice(0, 500);
    const rows = await db
      .select({ user_phonenumber: users.userPhonenumber })
      .from(users)
      .where(
        and(
          eq(users.userId, sessions.currentUserID),
          ne(users.userActive, "-99"),
        ),
      );
    const user = rows?.[0];
    if (!user) {
      return response;
    }

    const liveStripeSubs = await db
      .select({ id: subscriptions.id, externalId: subscriptions.externalId })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, sessions.currentUserID),
          eq(subscriptions.externalPlatform, 1),
          inArray(subscriptions.status, [1, 2, 4]),
        ),
      );
    for (const sub of liveStripeSubs) {
      try {
        await stripe_gateway.subscriptions.cancel(sub.externalId);
      } catch (err) {
        // Already gone at Stripe is fine; anything else means they could still be billed.
        // @ts-ignore
        if (err?.code !== "resource_missing") {
          tools.serverLog(
            `Account deletion: couldn't cancel subscription ${sub.externalId}: ${err}`,
            "pushDeleteAccount-1",
          );
          response.code = 502;
          response.message =
            "We couldn't cancel your subscription, so your account wasn't deleted. Please try again in a moment.";
          return response;
        }
      }
      await db
        .update(subscriptions)
        .set({ status: 3, canceledAt: sql`NOW()` })
        .where(eq(subscriptions.id, sub.id));
    }

    // user_delete_data is a native JSON column -- pass the object, not a
    // pre-stringified string (Drizzle's json() stringifies on write).
    const [result] = await db
      .update(users)
      .set({
        userActive: "-99",
        userDeletedDate: Math.floor(Date.now() / 1000),
        userDeleteData: { phonenumber: user.user_phonenumber, reason },
        userPhonenumber: "",
      })
      .where(
        and(
          eq(users.userId, sessions.currentUserID),
          ne(users.userActive, "-99"),
        ),
      );

    if (result.affectedRows > 0) {
      response.code = 200;
      response.message = "Account deleted.";
    }
  } catch (err) {
    tools.serverLog(
      `Error in pushDeleteAccount: ${err}`,
      "pushDeleteAccount-0",
    );
    response.code = 500;
    response.message = "Unable to delete account.";
  }

  return response;
}
