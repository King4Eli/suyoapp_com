import { db } from "../../db/client.js";
import { usersDevices } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * Registers or refreshes a device row, called once on app init rather than
 * on every log call. Callers reference the device afterwards by device_id.
 * @param {any} device
 */
export default async function pushDevice(
  device,
  userId = sessions.currentUserID,
) {
  const response = {
    code: 400,
    message: "Error registering device.",
    data: null,
  };
  try {
    const deviceId = device?.InstallationId || device?.Id;
    if (!deviceId || !userId) {
      response.message = "Missing device or user.";
      return response;
    }

    const values = {
      userId,
      deviceId,
      deviceName: device?.Name ?? null,
      deviceModel: device?.Model ?? null,
      deviceBrand: device?.Brand ?? null,
      deviceType: device?.Type ?? null,
      manufacturer: device?.Manufacturer ?? null,
      deviceOs: device?.Os ?? null,
      carrier: device?.Carrier ?? null,
      userAgent: device?.UserAgent ?? null,
      screenWidth: device?.ScreenDimension?.width
        ? Math.round(device.ScreenDimension.width)
        : null,
      screenHeight: device?.ScreenDimension?.height
        ? Math.round(device.ScreenDimension.height)
        : null,
      isEmulator: device?.isEmulator ? 1 : 0,
      appVersion: device?.app_version ?? null,
    };

    await db
      .insert(usersDevices)
      .values(values)
      .onDuplicateKeyUpdate({ set: values });

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
