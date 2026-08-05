import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
// @ts-ignore
import variables from "../../global/variables.json" with { type: "json" };
/**
 * @param {string} scripts
 * @param {string | undefined}  requestIP 
 */
export default async function pushLogReport(scripts, requestIP) {
    const response = { code: 400, message: "Error generating report." };
    try {
        const jsonStatsRaw = scripts ?? "{}";
        const decodeStats = JSON.parse(jsonStatsRaw);
        const type = decodeStats.type ?? "undef_Type";
        const ipAddr = requestIP ?? "n/a";

        // User-submitted "report this person"/"report this post" flows are moderation data,
        // not app logs -- they go into users_reported, keyed to both the reported and
        // reporting user. A feed post report lands here too, against the post's author,
        // with reported_post_id set so moderators can pull up the specific post.
        if (type === "reportuser" || type === "reportfeedpost") {
            const reportedUserId = decodeStats?.user?.reporteduserId;
            const reportedPostId = type === "reportfeedpost" ? (decodeStats?.user?.reportedPostId || null) : null;
            const reason = decodeStats?._error?.description || "No reason provided.";
            if (!reportedUserId) {
                response.code = 400;
                response.message = "Missing reported user.";
                return response;
            }
            /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
            const [result] = await db_pool.query(
                `INSERT INTO users_reported (user_id, reporter_user_id, reported_post_id, reason, status)
                VALUES (?, ?, ?, ?, 0)`,
                [reportedUserId, sessions.currentUserID, reportedPostId, reason]
            );
            if (result.affectedRows > 0) {
                response.code = 200;
                response.message = "report generated";
            }
            return response;
        }

        // Generic application/error log
        // Device details live in users_devices (registered once via pushDevice on
        // app init) -- we only store the device_id reference here, not the full
        // device payload, so it isn't re-sent/duplicated on every single log.
        const genId = tools.generateAlphanumeric(11, 30);
        const deviceId = decodeStats.device_id ?? null;
        const enrichedStats = {
            ...decodeStats,
            device_id: undefined,
            requestIP: ipAddr,
            user: { ...(decodeStats.user ?? {}), currentuser: sessions.currentUserID },
            app: { ...(decodeStats.app ?? {}), apiVersion: variables.site.api_version },
        };
        const jsonStats = JSON.stringify(enrichedStats);
        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [result] = await db_pool.query(`INSERT INTO logs_application
            (report_id, report_type, report_data, report_status, report_currentuser, device_id)
            VALUES (?, ?, ?, 0, ?, ?)`, [genId, type, jsonStats, sessions.currentUserID, deviceId]);

        if (result.affectedRows > 0) {
            response.code = 200;
            response.message = "report generated";
        }
    }
    catch (err) {
        tools.serverLog(`Error in frontend pushLogReport: ${err}`,"pushLogReport-0");
        response.code = 400;
        response.message = "Error generating report.";
    }
    return response;
}
