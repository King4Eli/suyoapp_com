import { and, eq, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * Soft-deletes the current user: user_active = -99, stamps user_deleted_date
 * (unix seconds) and moves the phone number into user_delete_data. Clearing
 * user_phonenumber frees the number -- signup and pushNewPhonenumber only
 * reject numbers that still exist in users, so it can register again.
 * @param {{ reason?: string }} data
 */
export default async function pushDeleteAccount(data) {
  /** @type {any} */
  const response = { code: 404, message: "Account not found." };

  try {
    const reason = String(data?.reason ?? "").trim().slice(0, 500);
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
    tools.serverLog(`Error in pushDeleteAccount: ${err}`, "pushDeleteAccount-0");
    response.code = 500;
    response.message = "Unable to delete account.";
  }

  return response;
}
