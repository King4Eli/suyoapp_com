import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { sessionManager } from '../SessionContext';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { namer } from '../static';
import { Toastx } from '../customNotification';
import { logReport } from '../functions';


// HTTP request function (GET/POST)
export const xxa__http_requests = async ({ reqType, bodyArray, headerArray, customApiUrl }: {
    reqType: 'GET' | 'POST', bodyArray?: Record<string, any>,
    headerArray?: Record<string, string>, customApiUrl: string
}): Promise<any | null> => {
    //start
    const currentSession = sessionManager.getCurrentSession();
    const apiUrlToUse = customApiUrl;
    let axiosResponse = null;

    let config = {
        method: reqType.toLowerCase(),
        url: apiUrlToUse,
        headers: headerArray ?? {
            'Content-Type': 'application/json',
            'X-omi-Auth': currentSession?.x_omi_payload,
            'X-omi-Hash': currentSession?.x_omi_payload_hash,
            "Accept-Encoding": "identity"
        },
        timeout: 60000, // 1 minute timeout
    } as any;

    try {
        const networkState = await NetInfo.fetch();
        if (!networkState.isConnected) {
            Alert.alert("Info", "You are not connected to the internet. Check your wifi connection");
            return false;
        }
        //
        //

        if (reqType === 'POST') {
            config.data = bodyArray;
            if (bodyArray instanceof FormData) {
                config.headers['Content-Type'] = 'multipart/form-data';
            }
        } else {
            config.params = bodyArray;
        }

        axiosResponse = await axios(config);
        //console.log(axiosResponse);
        const contentType = axiosResponse?.headers['content-type'];
        if (contentType?.includes('application/json')) {
            const jsonres = axiosResponse?.data;

            // json error
            if (typeof jsonres !== 'object' || jsonres === null) {
                logReport({ type: "http", extra: jsonres, useraction: 'http JSON parse', url: apiUrlToUse, logMessage: "", stackTrace: "" });
            }
            return jsonres;
        }
        // fallback for text
        return typeof axiosResponse?.data === 'string' ? axiosResponse?.data : JSON.stringify(axiosResponse?.data);

    } catch (err: any) {
        const status = err.response?.status;
        if (err.response) {
            if (status === 401) {
                //session expired 
                sessionManager?.updateSession({ x_omi_payload: null, x_omi_payload_hash: null });
                await AsyncStorage.removeItem(namer.storage.sessionId);
                Toastx.show({ type: 'info', message: 'Session expired, login again.' });
                return;
            } else if (status === 404) {
                Toastx.show({ type: 'error', message: 'Resource not found!' });
            }
            logReport({ type: "http " + status, useraction: 'url access', url: apiUrlToUse, logMessage: err.message, stackTrace: err.response });
            return null;
        } else {

            Toastx.show({ type: 'error', message: 'Client: Network timeout' });
        }

        logReport({ type: 'http -' + status, extra: JSON.stringify(axiosResponse ?? config), useraction: 'HTTP request error', url: apiUrlToUse, logMessage: err.message, stackTrace: err });
        return null;
    }
};
