import { db } from "../../db/client.js";
import { usersReported } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * Report a user, optionally in the context of a specific feed post. Moderation data,
 * not an app log -- goes straight into users_reported, keyed to both the reported and
 * reporting user, with reported_post_id set when the report originated from a post.
 * @param {{ reportedUserId?: string; reportedPostId?: string; reason?: string }} data
 */
export default async function pushReportUser(data) {
  /** @type {any} */
  const response = { code: 400, message: "Error generating report." };

  try {
    const reportedUserId = data?.reportedUserId;
    const reportedPostId = data?.reportedPostId || null;
    const reason = data?.reason?.trim() || "No reason provided.";

    if (!reportedUserId) {
      response.message = "Missing reported user.";
      return response;
    }

    const [result] = await db.insert(usersReported).values({
      userId: reportedUserId,
      reporterUserId: sessions.currentUserID,
      reportedPostId,
      reason,
      status: 0,
    });

    if (result.affectedRows > 0) {
      response.code = 200;
      response.message = "report generated";
    }
  } catch (err) {
    tools.serverLog(`Error in pushReportUser: ${err}`, "pushReportUser-0");
    response.code = 500;
    response.message = "Error generating report.";
  }

  return response;
}
