import { db } from "../../db/client.js";
import { logsApplication } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
// @ts-ignore
import variables from "../../global/variables.json" with { type: "json" };

// Upper bound on how many log entries one request may carry (offline-queue
// flushes send them in batches) -- anything beyond this is dropped defensively.
const MAX_LOGS_PER_REQUEST = 500;

/**
 * Store one or many frontend log reports. Works with or without a session.
 *
 * Attribution: a log belongs to an account only if it was created while that
 * account was signed in on the device (entry.uid, recorded by the app at log
 * time) AND this request carries a valid session for the same user -- so a log
 * queued while signed out, or under a different account, is never credited to
 * whoever happens to be signed in when the queue flushes. Otherwise the user is
 * left empty. Entries from older app versions have no `uid` field; those keep
 * the old behaviour (credited to the request's session, if any).
 *
 * `scripts` is a JSON string holding either a single log object (legacy, direct
 * send) or an array of them (offline queue flush). Both shapes are accepted and
 * written in a single bulk INSERT.
 *
 * @param {string} scripts
 * @param {string | undefined}  requestIP
 */
export default async function pushLogReport(scripts, requestIP) {
  const response = {
    code: 400,
    message: "Error generating report.",
    inserted: 0,
  };
  try {
    const decoded = JSON.parse(scripts ?? "{}");
    const list = (Array.isArray(decoded) ? decoded : [decoded])
      .filter((entry) => entry && typeof entry === "object")
      .slice(0, MAX_LOGS_PER_REQUEST);

    if (list.length === 0) {
      response.code = 200;
      response.message = "no reports to store";
      return response;
    }

    const ipAddr = requestIP ?? "n/a";

    // Generic application/error log rows.
    // Device details live in users_devices (registered once via pushDevice on
    // app init) -- we only store the device_id reference here, not the full
    // device payload, so it isn't re-sent/duplicated on every single log.
    const sessionUser = sessions.currentUserID ?? null;
    const rows = list.map((decodeStats) => {
      const type = decodeStats.type ?? "undef_Type";
      const deviceId = decodeStats.device_id ?? null;
      const loggedUser = !("uid" in decodeStats)
        ? sessionUser
        : decodeStats.uid && decodeStats.uid === sessionUser
          ? sessionUser
          : null;
      const enrichedStats = {
        ...decodeStats,
        device_id: undefined,
        uid: undefined,
        requestIP: ipAddr,
        user: {
          ...decodeStats.user,
          currentuser: loggedUser ?? undefined,
        },
        app: {
          ...decodeStats.app,
          apiVersion: variables.site.api_version,
        },
      };
      return {
        reportId: tools.generateAlphanumeric(11, 30),
        reportType: type,
        reportData: JSON.stringify(enrichedStats),
        reportStatus: 0,
        reportCurrentuser: loggedUser,
        deviceId,
      };
    });

    const [result] = await db.insert(logsApplication).values(rows);

    if (result.affectedRows > 0) {
      response.code = 200;
      response.message = "report generated";
      response.inserted = result.affectedRows;
    }
  } catch (err) {
    tools.serverLog(
      `Error in frontend pushLogReport: ${err}`,
      "pushLogReport-0",
    );
    response.code = 400;
    response.message = "Error generating report.";
  }
  return response;
}
