import DeviceInfo from "react-native-device-info";
import appjson from '../../../app.json';
import { cacheStorage } from "../functions.ts";
import { __CONFIG__ } from "../static";
import { sessionManager } from "../SessionContext";

// Log function for debugging
export const xxa_logggingReport = ({ type, extra, useraction, url, logMessage }: { type: string, extra?: string, useraction: string, url?: string, logMessage: string, stackTrace?: any }): void => {
    async function getAppMeta() {
        const [FirstInstallTime, LastUpdateTime] = await Promise.all([
            DeviceInfo.getFirstInstallTime(),
            DeviceInfo.getLastUpdateTime()
        ]);

        return {
            version_app: DeviceInfo.getVersion(),
            version_bundle: appjson.appversion,
            buildNumber_app: DeviceInfo.getBuildNumber(),
            buildNumber_bundle: appjson.bundlebuildnumber,
            displayName_app: DeviceInfo.getApplicationName(),
            displayName_bundle: appjson.name,
            appPackageName: DeviceInfo.getBundleId(),
            appVersionName: DeviceInfo.getReadableVersion(),
            FirstInstallTime,
            LastUpdateTime
        };
    }
    (async () => {
        try {
            const deviceData = await cacheStorage.getDeviceData();
            const logD = {
                "type": type,
                "_error": {
                    "url": url,
                    "useraction": useraction,
                    "description": logMessage,
                    "extras": extra,
                },
                // Device details live in users_devices (registered once via
                // registerDevice on app init) -- only the reference is sent here,
                // not the full device payload, on every single log.
                "device_id": deviceData?.InstallationId || deviceData?.Id,
                "app": await getAppMeta(),
            }

            try {
                console.log("logReport:", logD);
                const res = await fetch(__CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushLogReport', {
                    method: 'POST', // Explicitly set method
                    headers: {
                        'Content-Type': 'application/json', // Specify content type
                        'Accept': 'application/json', // Specify accepted response type
                        'X-omi-Auth': sessionManager.getCurrentSession()?.x_omi_payload ?? ''
                    },
                    body: JSON.stringify({ // Properly stringify the entire body
                        action: 'generateLogStats',
                        scripts: JSON.stringify(logD) // No need to stringify logD twice
                    })
                });
            } catch (e: any) {
                console.log("logReport fetch error:", e.message);
                logD._error.extras += " |||| logReport fetch error: " + e.message;
            }
        } catch (error: any) {
            console.error("logReport: fetching device info", error.message);
        }
    })();

};
