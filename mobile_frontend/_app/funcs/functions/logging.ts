import DeviceInfo from "react-native-device-info";
import appjson from '../../../app.json';
import { hostServer, cacheStorage } from "../functions.ts";
import { sessionManager } from "../SessionContext";

// Log function for debugging
export const xxa_logggingReport = ({ type, extra, useraction, url, logMessage, reporteduserId }: { type: string, extra?: string, useraction: string, url?: string, logMessage: string, stackTrace?: any, reporteduserId?: string }): void => {
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
            const logD = {
                "type": type,
                "_error": {
                    "url": url,
                    "useraction": useraction,
                    "description": logMessage,
                    "extras": extra,
                },
                "user": {},
                "device": await cacheStorage.getDeviceData(),
                "app": await getAppMeta(),
            }

            try {
                console.log("logReport:", logD);
                const res = await fetch(hostServer() + '/api/core/v1/pushLogReport', {
                    method: 'POST', // Explicitly set method
                    headers: {
                        'Content-Type': 'application/json', // Specify content type
                        'Accept': 'application/json', // Specify accepted response type
                        'X-omi-Auth': sessionManager.getCurrentSession()?.x_omi_payload ?? '',
                        'X-omi-Hash': sessionManager.getCurrentSession()?.x_omi_payload_hash ?? ''
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
