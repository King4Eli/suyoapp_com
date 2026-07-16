import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import ngeohash from "ngeohash";

function normalizeLocation(value={}) {
    const location = typeof value === "string" ? JSON.parse(value) : value;
    const latd = Number(location?.latd ?? location?.lat ?? location?.latitude);
    const long = Number(location?.long ?? location?.lng ?? location?.longitude);

    if (!Number.isFinite(latd) || !Number.isFinite(long)) {
        return null;
    }

    return {
        ...location,
        latd,
        long,
        geo_hash: ngeohash.encode(latd, long, 12),
    };
}

/**
 * @param {string} longlatd
 */
export default async function pushLocation(longlatd, userId = sessions.currentUserID) {
    const response = {
        code: 400,
        message: "Error updating location.",
        data: null
    };
    try {
        if (!longlatd) {
            response.message = "Invalid coordinates.";
            return response;
        }
        const jsonDecodeLocation = normalizeLocation(longlatd);
        if (!jsonDecodeLocation) {
            response.message = "Invalid coordinates.";
            return response;
        }

        /** @type {any} */
        let specsDecode = {};
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${jsonDecodeLocation.latd}&lon=${jsonDecodeLocation.long}`;
            const apiRes = await fetch(url, { headers: { "User-Agent": "MyApp" } });
            specsDecode = await apiRes.json();
        }
        catch (err) {
            tools.serverLog(`Reverse geocode failed: ${err}`,"pushLocation-100");
        }

        const address = specsDecode.address ?? {};
        const enrichedLocation = {
            ...jsonDecodeLocation,
            display_name: specsDecode.display_name ?? "unknown",
            neighbourhood: address.neighbourhood ?? "unknown",
            city: address.city ?? "unknown",
            country: address.country ?? "unknown",
            state: address.state ?? "unknown",
            postcode: address.postcode ?? "unknown",
            road: address.road ?? "unknown",
            street: address.street ?? "unknown",
        };
        const jsonCords = JSON.stringify(enrichedLocation);
        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [result] = await db_pool.query(
            "UPDATE users SET geo_meta = ?, geo_hash = ?, geo_long = ?, geo_latd = ? WHERE user_id = ?",
            [jsonCords, jsonDecodeLocation.geo_hash, jsonDecodeLocation.long, jsonDecodeLocation.latd, userId]
        );

        if (result.affectedRows > 0) {
            response.code = 200;
            response.message = "ok";
            response.data = enrichedLocation;
        }
    }
    catch (err) { 
        tools.serverLog(`Error in pushLocation: ${err}`,"pushlocation-101");
        response.code = 500;
        response.message = "Error updating location.";
    }
    return response;
}
