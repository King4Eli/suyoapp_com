import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";
// @ts-ignore
import variables from "../../global/variables.json" with { type: "json" };
/**
 * @param {string} scripts
 * @param {string | undefined}  requestIP 
 */
export default async function pushLogReport(scripts, requestIP) {
    const response = { code: 400, message: "Error generating report." };
    try {
        const genId = tools.generateAlphanumeric(11, 30);
        const jsonStatsRaw = scripts ?? "{}";
        const decodeStats = JSON.parse(jsonStatsRaw);
        const type = decodeStats.type ?? "undef_Type";
        const ipAddr = requestIP ?? "n/a";
        // enrich stats
        const enrichedStats = {
            ...decodeStats,
            device: { ...(decodeStats.device ?? {}), requestIP: ipAddr },
            user: { ...(decodeStats.user ?? {}), currentuser: sessions.currentUserID },
            app: { ...(decodeStats.app ?? {}), apiVersion: variables.site.api_version },
        };
        const jsonStats = JSON.stringify(enrichedStats);
        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [result] = await db_pool.query(`INSERT INTO logreports 
            (report_id, report_type, report_data, report_status, report_currentuser)
            VALUES (?, ?, ?, 0, ?)`, [genId, type, jsonStats, sessions.currentUserID]);

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
