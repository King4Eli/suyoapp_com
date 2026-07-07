import db_pool from '../../global/database.js';
import { tools } from '../../global/functions.js';

export default async function getPrompts() {
    /** @type { any } */
    const response = {
        code: 404,
        message: 'No prompts found.',
        prompts: []
    };

    const sql = `
        SELECT id_ai, question
        FROM prompts_variant
        WHERE status = 1
        ORDER BY rand() ASC LIMIT 16
    `;

    try {
        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [rows] = await db_pool.query(sql);

        if (Array.isArray(rows) && rows.length > 0) {
            response.code = 200;
            response.message = 'ok';
            response.prompts = rows.map((row) => ({
                id_ai: Number(row.id_ai),
                question: String(row.question ?? '')
            }));
        }
    } catch (error) {
        tools.serverLog(`Error in getPrompts: ${error}`,"getPrompts-100");
        response.code = 500;
        response.message = 'Internal server error';
    }

    return response;
}
