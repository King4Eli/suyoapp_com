import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionManager } from '../SessionContext';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { namer } from '../static';
import { Toastx } from '../customNotification';
import { logReport } from '../functions';

// HTTP request function (GET/POST)
export const xxa__http_requests = async ({
  reqType,
  bodyArray,
  headerArray,
  customApiUrl,
}: {
  reqType: 'GET' | 'POST';
  bodyArray?: Record<string, any>;
  headerArray?: Record<string, string>;
  customApiUrl: string;
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
      'Accept-Encoding': 'identity',
    },
    timeout: 60000, // 1 minute timeout
  } as any;

  try {
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      Toastx.show({
        type: 'error',
        message: "You're offline. Check your connection and try again.",
        duration: 5000,
      });
      return null;
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
        logReport({
          type: 'http',
          extra: jsonres,
          useraction: 'http JSON parse',
          url: apiUrlToUse,
          logMessage: '',
          stackTrace: '',
        });
      }
      return jsonres;
    }
    // fallback for text
    return typeof axiosResponse?.data === 'string'
      ? axiosResponse?.data
      : JSON.stringify(axiosResponse?.data);
  } catch (err: any) {
    const status = err.response?.status;
    if (err.response) {
      if (status === 401) {
        //session expired
        sessionManager?.updateSession({ x_omi_payload: null });
        await AsyncStorage.removeItem(namer.storage.sessionId);
        Toastx.show({ type: 'info', message: 'Session expired, login again.' });
        return;
      } else if (status === 404) {
        Toastx.show({ type: 'error', message: 'Resource not found!' });
      }
      logReport({
        type: 'http ' + status,
        useraction: 'url access',
        url: apiUrlToUse,
        logMessage: err.message,
        stackTrace: err.response,
      });
      return null;
    } else {
      Toastx.show({
        type: 'error',
        message: 'Network error. Check your connection and try again.',
        duration: 5000,
      });
    }

    logReport({
      type: 'http -' + status,
      extra: JSON.stringify(axiosResponse ?? config),
      useraction: 'HTTP request error',
      url: apiUrlToUse,
      logMessage: err.message,
      stackTrace: err,
    });
    return null;
  }
};

/**
 * Produces a user-friendly message for a raw `fetch()` failure -- the few call sites that
 * bypass `xxa__http_requests` (OTP send/verify during signup/login) still need the same
 * "are they actually offline" triage this wrapper does internally above, instead of
 * leaking fetch's raw rejection text (e.g. "Network request failed") straight to a toast.
 */
export const getFriendlyNetworkErrorMessage = async (
  error: any,
  fallback = 'Something went wrong. Please try again.',
): Promise<string> => {
  try {
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      return "You're offline. Check your connection and try again.";
    }
  } catch {}

  if (error?.message === 'Network request failed') {
    return 'Network error. Check your connection and try again.';
  }
  return error?.message || fallback;
};
