import db_pool from '../../global/database.js';
import { tools } from '../../global/functions.js';

const DEFAULT_GET_WHAT = {
    intent: "bio_intent",
    gender: "bio_gender",
    drinking: 'bio_drinking',
    pets: 'bio_pets',
    smoking: "bio_smoking",
    kids: "bio_children",
    education: "bio_education",
    ethnicity: "bio_ethnicity",
    interests: "bio_interests",
    language: "bio_language",
    religion: "bio_religion",
    politicalview: "bio_politicalview",
    prompts: "bio_prompt",
    img_domain: "img_domain"
};


export default async function getMapper(/** @type {any} */ wha2get) {
    const response = {
        code: 404,
        message: 'No mapper data found.',
        map: {}
    };

    try {
        const requestedKeys = Array.isArray(wha2get)
            ? wha2get
            : Array.isArray(wha2get?.wha2get)
                ? wha2get.wha2get
                : [];

        const normalizedKeys = Array.from(new Set(
            requestedKeys
                .map((/** @type {any} */ item) => String(item ?? '').trim())
                .filter(Boolean)
        ));

        const allowedKeys = Object.keys(DEFAULT_GET_WHAT);
        const selectedKeys = normalizedKeys.length > 0
            ? normalizedKeys.filter(key => allowedKeys.includes(key))
            : allowedKeys;

        
        /** @type {any} */
        const mapper = {};
        /** @type {any} */
        const typeToKey = {};

        for (const key of selectedKeys) {
            mapper[key] = [];
            typeToKey[DEFAULT_GET_WHAT[key]] = key;
        }

        if (selectedKeys.length > 0) {
            const mapTypes = selectedKeys.map(key => DEFAULT_GET_WHAT[key]);
            const sql2 = "SELECT map_label,map_code,map_type FROM mapping_lookup" +
                " WHERE map_type IN (" + mapTypes.map(val => `'${val}'`).join(',') + ")";
                    /** @type {any} */
                const [rows] = await db_pool.query(sql2);

            for (const row of rows) {
                const key = typeToKey[row.map_type];
                if (key) {
                    mapper[key].push(row);
                }
            }
        }

        response.map = mapper;
        response.code = Object.keys(mapper).length > 0 ? 200 : 404;
        response.message = response.code === 200 ? 'ok' : 'No mapper data found.';
    } catch (error) {
        tools.serverLog(`Error in getMapper: ${error}`,'getMapper-100');
        response.code = 500;
        response.message = 'Internal server error.';
    }

    return response;
}
