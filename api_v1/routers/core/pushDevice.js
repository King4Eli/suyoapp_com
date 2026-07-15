import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";

/**
 * Registers or refreshes a device row, called once on app init rather than
 * on every log call. Callers reference the device afterwards by device_id.
 * @param {any} device
 */
export default async function pushDevice(device, userId = sessions.currentUserID) {
    const response = { code: 400, message: "Error registering device.", data: null };
    try {
        const deviceId = device?.InstallationId || device?.Id;
        if (!deviceId || !userId) {
            response.message = "Missing device or user.";
            return response;
        }

        await db_pool.query(
            `INSERT INTO users_devices
                (user_id, device_id, device_name, device_model, device_brand, device_os, is_emulator, app_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                user_id = VALUES(user_id),
                device_name = VALUES(device_name),
                device_model = VALUES(device_model),
                device_brand = VALUES(device_brand),
                device_os = VALUES(device_os),
                is_emulator = VALUES(is_emulator),
                app_version = VALUES(app_version)`,
            [
                userId,
                deviceId,
                device?.Name ?? null,
                device?.Model ?? null,
                device?.Brand ?? null,
                device?.Os ?? null,
                device?.isEmulator ? 1 : 0,
                device?.app_version ?? null,
            ]
        );

        response.code = 200;
        response.message = "ok";
        response.data = { device_id: deviceId };
    } catch (err) {
        tools.serverLog(`Error in pushDevice: ${err}`, "pushdevice-0");
        response.code = 500;
        response.message = "Error registering device.";
    }
    return response;
}
