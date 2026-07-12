import db_pool from '../../global/database.js';
import { tools } from '../../global/functions.js';

export default async function getReligions() {
    /** @type { any } */
    const response = {
        code: 404,
        message: 'No religions found.',
        religions: []
    };

    const sql = `
        SELECT id_ai, label
        FROM religion_variant
        WHERE status = 1
        ORDER BY id_ai ASC
    `;

    try {
        /** @type {[any[], any]} */
        const [rows] = await db_pool.query(sql);

        if (Array.isArray(rows) && rows.length > 0) {
            response.code = 200;
            response.message = 'ok';
            response.religions = rows.map((row) => ({
                id_ai: Number(row.id_ai),
                label: String(row.label ?? '')
            }));
        }
    } catch (error) {
        tools.serverLog(`Error in getReligions: ${error}`, "getReligions-100");
        response.code = 500;
        response.message = 'Internal server error';
    }

    return response;
}
