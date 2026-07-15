import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, Dimensions, PermissionsAndroid, Platform, Vibration } from 'react-native';
import { sessionManager } from './SessionContext';
import Geolocation from 'react-native-geolocation-service';
import { namer, __CONFIG__ } from './static';
import { Asset, ImageLibraryOptions, launchImageLibrary } from 'react-native-image-picker';
import { Toastx } from './customNotification';
import { SocketClient } from './socket_realtimeData';
import { createNavigationContainerRef } from '@react-navigation/native';
import { xxa_logggingReport } from './functions/logging';
import { xxa__http_requests } from './functions/httpRequest';
import { cacheStorage } from './functions/llstorage';

export { cacheStorage as cacheStorage }
export { xxa_logggingReport as logReport };
export { xxa__http_requests as _http_request };
 
export const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
export const navigationRef = createNavigationContainerRef<any>();


// Helper functions for encoding/decoding
export const help = {
  randomInt(minOrMax: number, max?: number) {
    const min = max !== undefined ? minOrMax : 0;
    const maxVal = max !== undefined ? max : minOrMax;

    return Math.floor(Math.random() * (maxVal - min + 1)) + min;
  },

  randomAlphanumeric: (max: number, min: number = 6, upperCase: boolean = false) => {
    const chars =
      (upperCase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '') +
      'abcdefghijklmnopqrstuvwxyz0123456789';

    const length = Math.floor(Math.random() * (max - min + 1)) + min;

    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  },
  encodeStr: (st: string): string => {
    // Placeholder for actual encoding logic
    return st.split('').reverse().join('');
  },
  decodeStr: (st: string): string => {
    // Placeholder for actual decoding logic
    return st.split('').reverse().join('');
  },

  getageFromDOB: (yyyymmdd: string) => {
    try {
      if (!/^\d{8}$/.test(yyyymmdd)) return null; // Basic validation

      const year = parseInt(yyyymmdd.substring(0, 4), 10);
      const month = parseInt(yyyymmdd.substring(4, 6), 10) - 1; // 0-indexed
      const day = parseInt(yyyymmdd.substring(6, 8), 10);

      const dob = new Date(year, month, day);
      const now = new Date();

      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();

      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
        age--;
      }
      return age.toString();
    } catch (e: any) {
      xxa_logggingReport({ type: 'function', extra: "yyyymmdd" + yyyymmdd, useraction: 'getageFromDOB', logMessage: e?.message });
      return null;
    }
  },
  getDOBFromAge: (age: string) => {
    try {
      const todayDate = new Date();
      const numericAge = Number(age);
      const year = todayDate.getFullYear() - numericAge;
      const month = String(todayDate.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
      const day = String(todayDate.getDate()).padStart(2, '0');

      return `${year}${month}${day}`;
    } catch (e: any) {
      xxa_logggingReport({ type: 'function', extra: 'age: ' + age, useraction: 'getDOBFromAge', logMessage: e?.message });
      return null;
    }
  },
  cmToFtIn: (cmValue: number) => {
    try {
      if (isNaN(cmValue)) return null;

      const inches = cmValue / 2.54;
      const feet = Math.floor(inches / 12);
      const remainingInches = Math.round(inches % 12);

      return (`${feet}ft' ${remainingInches}in`);
    } catch (e: any) {
      xxa_logggingReport({ type: 'function', extra: 'cmValue ' + cmValue, useraction: 'cmToFtIn', logMessage: e?.message  });
      return null;
    }
  },
  milesToKM: (milesValue: number) => {
    try {
      if (isNaN(milesValue)) return null;

      const km = milesValue * 1.60934;

      return km;
    } catch (e: any) {
      xxa_logggingReport({ type: 'function', extra: 'milesToKM: ' + milesValue, useraction: 'milestokm', logMessage: e?.message });
      return null;
    }
  },
  timeAgo: (unixSeconds:string) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const pastSeconds = Number(unixSeconds);
  const seconds = nowSeconds - pastSeconds;

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const intervals = {
    year: 31536000,
    month: 2592000,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count >= 1) {
      return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
},
  getSubscriptionState: (profile: any) => {
    const rawPlan =
      profile?.subscription?.product_name ??
      null;
    const rawVariant =
      profile?.subscription?.plan_name ??
      null;
    const hasActive = Boolean(
      profile?.subscription?.status === 'active'
    );
    const tier = String(rawPlan ?? '').trim().toLowerCase();

    return {
      hasActive,
      plan: rawPlan,
      variant: rawVariant,
      tier,
      isPlus: hasActive && tier === 'plus',
      isVip: hasActive && tier === 'vip',
    };
  }
};




export const __init__app = async (): Promise<void> => {
  // get mapper
  await cacheStorage.CONFIG.getMapper();

  // get session and verify
  const getSession_omi = sessionManager.getCurrentSession()?.x_omi_payload;
  const getSession_hash = sessionManager.getCurrentSession()?.x_omi_payload_hash;
  const notSessionAndNavigation = (!getSession_omi || !getSession_hash || navigationRef === null)
  
  // 111111
  // update location
  await (async ()=>{
    await getCurrentLocation().then(async (location: any) => {
          if (location) {
              let cords = {
                  latd: location?.coords?.latitude,
                  long: location?.coords?.longitude,
                  accuracy: location.coords.accuracy,
                  altitude: location.coords.altitude,
                  altitudeAccuracy: location.coords.altitudeAccuracy,
                  heading: location.coords.heading,
                  speed: location.coords.speed,
                  timestamp: location.timestamp,
              };
              // Update the current user profile with the new location
              await xxa__http_requests({
                  customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/pushLocation",
                  reqType: 'POST', bodyArray: {
                      longlatd: JSON.stringify(cords),
                  }
                }).then(()=>{
                  cacheStorage.getCurrentUserProfile(true)
                });
          }
    });                  
  })();

  // 222222
  // connect with socket for realtime info
  (async () => {
    console.log(`🟨 [INIT] socket-connect step -> notSessionAndNavigation=${notSessionAndNavigation}`);
    if (notSessionAndNavigation){
      Toastx.show({
        message: "Session not found.",
        type: 'info'
      });
      return;
    }

    try {
      const getProfile = await cacheStorage.getCurrentUserProfile();
      const userId = getProfile?.profile?.id;
      console.log(`🟨 [INIT] socket-connect step -> gotProfile=${Boolean(getProfile)} userId=${userId}`);
      if (!userId) return;
      SocketClient.connect(userId, (data) => {
      const retrivedData = data?.message;
      if (data.event === 'message') {
        if (retrivedData?.type !== "single-convo") return;
        /*
        {
            "type":"single-convo",
            "matchId": "pyca6r5dngyrbauhnn916a", 
            "payload":{
                "firstName":"firstName",
                "lastMessage":"ghufhjg"
            }
        } 
        */
        const navigationRef_route = navigationRef.getCurrentRoute();

        if (navigationRef_route?.name === namer.navigation.conversation) {
          // @ts-ignore
          if (navigationRef_route.params?.matchId === retrivedData?.matchId) {
            if (navigationRef.isReady()) navigationRef.setParams({ realtimedata: retrivedData?.payload });
          } else {

          }
        } else {
          const nmessage = (retrivedData?.payload?.firstName ?? "Someone") + " has messaged you";
          if (AppState.currentState === 'active') {
            Vibration.vibrate(100);
            Toastx.show({
              title: nmessage,
              message: "Tap to view message",
              type: 'info',
              onPress: () => {
                if (navigationRef.isReady()) navigationRef.navigate(namer.navigation.conversation, { matchId: retrivedData?.matchId });
              }
            });
          } else if (AppState.currentState === 'background' || AppState.currentState === 'inactive') {
            //displsyNotification(nmessage, "Tap to view message");
          }
        }
      }
      });
    } catch (error: any) {
      console.log(`🔴 [INIT] socket-connect step FAILED -> ${error?.message || String(error)}`);
      xxa_logggingReport({
        type: "function",
        extra: error?.message || String(error),
        useraction: 'initSocketConnect',
        logMessage: error?.message || String(error),
        stackTrace: error
      });
    }
  })();
}


// Cold-start deep links (Linking.getInitialURL) can fire before <NavigationContainer>
// has mounted, so navigationRef.isReady() is briefly false — poll instead of busy-looping
// or checking once. Never call navigate/resetRoot while isReady() is false; it will throw.
async function waitForNavigationReady(timeoutMs = 4000, intervalMs = 100): Promise<boolean> {
  const start = Date.now();
  while (!navigationRef.isReady()) {
    if (Date.now() - start >= timeoutMs) return false;
    await new Promise<void>((resolve) => setTimeout(() => resolve(), intervalMs));
  }
  return true;
}

// Stripe's webhook can land a moment after the success redirect, so poll the
// lightweight entitlement endpoint briefly instead of trusting a single profile refetch.
async function waitForEntitlementRefresh(maxAttempts = 5, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const entitlement = await xxa__http_requests({
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getEntitlement',
        reqType: 'POST',
      });
      if (entitlement?.hasActiveSubscription) {
        return true;
      }
    } catch (error) {
      console.error('Entitlement refresh check failed:', error);
    }
    if (attempt < maxAttempts) {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), delayMs));
    }
  }
  return false;
}

export function handleDeepLink(url: string) {
  if (!url) return;

  try {
    const match = url.match(/^(\w+):\/\/([^/]+)(\/.*)?$/);
    if (!match) return;
    const [, scheme, host, rawPath = '/'] = match;
    // clean path
    const path = rawPath.split('?')[0].replace(/\/$/, '') || '/';

    const paymentRoutes: Record<string, () => void> = {
      '/payment/success': async () => {
        Toastx.show({ type: 'success', message: 'Payment successful — your plan is now active', duration: 8000 });

        // Give the Stripe webhook a chance to land before pulling the fresh profile,
        // since the checkout redirect can beat the webhook to our server.
        await waitForEntitlementRefresh();

        await Promise.all([
          cacheStorage.getCurrentUserProfile(true),
          cacheStorage.getProducts(true),
        ]);

        if (await waitForNavigationReady()) {
          navigationRef.resetRoot({
            index: 0,
            routes: [
              {
                name: namer.navigation.home,
                state: {
                  routes: [
                    { name: namer.navigation.profile },
                  ],
                },
              },
            ],
          });
        }
      },
      '/payment/cancelled': () => {
        Toastx.show({ type: 'info', message: 'Payment cancelled — no charge was made', duration: 9000 });
      },
    };

    const handler = paymentRoutes[path];

    if (handler) {
      handler();
    } else {
      console.log('No route match:', host, path);
    }

  } catch (error) {
    console.error('Deep link error:', error);
  }
}



// Handle login
export const _handle_Signin = async (phoneNumber: string, callingCode: string, vscode: string | null): Promise<{ code: number, message?: string, redirect?: string }> => {
  let err: string | null = null;
  if (!vscode || vscode.length < 6) {
    if (phoneNumber.length <= 5) {
      err = 'Invalid username or password!.';
    }
    //
    if (err === null) {
      const loginRes = await xxa__http_requests({
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/login',
        reqType: 'POST', bodyArray: {
          cc: callingCode,
          user_phone: phoneNumber
        }
      });
      if (loginRes?.code === 200) {
        await sessionManager.updateSession({
          x_omi_payload: "",
          x_omi_payload_hash: null,
        });
        return {
          code: 200,
          message: "Login sus"
        };
      } else if (loginRes?.code === 404) {
        return {
          code: 404,
          message: "redirecting to signup",
          redirect: "signup"
        };
      } else {
        err = loginRes?.message ?? "Error logging in!";
      }
    }
  } else if (vscode && vscode.length >= 6) {
    if (err === null) {
      const loginRes = await fetch(__CONFIG__.HTTPS_API_DOMAIN + "/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_phone: phoneNumber,
          cc: callingCode,
          vcode: vscode,
        }),
      });

      const headers = loginRes.headers;
      const response = await loginRes.json();

      if (response?.code === 200) {
        const auth = headers.get('x-omi-auth') ?? '';
        const hash = headers.get('x-omi-hash') ?? '';

        await AsyncStorage.setItem(namer.storage.sessionId, auth);
        await AsyncStorage.setItem(namer.storage.sessionIdVerify, hash);
        await sessionManager.updateSession({
          x_omi_payload: auth,
          x_omi_payload_hash: hash,
        });

        return {
          code: 200,
          message: "Login success"
        };
      } else {
        err = response?.message ?? "Error logging in!";
      }
    }
  }

  // Login failed
  return {
    code: 400,
    message: err ?? "Error signing in function."
  };
};

// Handle signup
export const _handle_Signup = async (
  textInput_: { verifypassword: string; password: string; email: string },
  get_setuserId: (uid: string) => void
): Promise<void> => {
  let err: string | false = false;

  if (textInput_.verifypassword !== textInput_.password) {
    err = 'Passwords do not match!';
  } else if (textInput_.password.length <= 5) {
    err = 'Password should be greater than 5 characters!';
  } else if (textInput_.email.length <= 5) {
    err = 'Invalid Email!';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textInput_.email)) {
    err = 'Invalid Email!!';
  }

  if (!err) {
    const signupRes = await xxa__http_requests({
      reqType: 'POST',
      customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/signup',
      bodyArray: {
        action: '2bu4tywnr7',
        fullname: help.encodeStr('frederick owens'),
        email: help.encodeStr(textInput_.email),
        password: help.encodeStr(textInput_.password),
      }
    });
    if (signupRes?.code === 200) {
      let uid = signupRes?.user_id ?? '';
      if (uid !== '') {
        //await AsyncStorage.setItem(namer.userId, uid);
        get_setuserId(uid);
      }
    } else {
      err = signupRes?.message ?? 'Account not created!';
    }
  }
  if (err) {
    Toastx.show({ type: 'error', message: 'Signup Error\n' + err });
    Alert.alert('Signup Failed', err);
  }
};


// Get current location with permission handling
export async function getCurrentLocation() {
  //get locations
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      Toastx.show({ type: 'error', message: 'Location permission denied' });
    }
  }
  if (Platform.OS === 'ios') {
    const status = await Geolocation.requestAuthorization('whenInUse');
    if (status !== 'granted') {
      Toastx.show({ type: 'error', message: 'Location permission denied' });
    }
  }
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
}




export const parseCategoryProducts = (productLists: any = false, categoryToGet: string) => {
  if (!productLists) return [];

  if (Array.isArray(productLists)) {
    const mainsubCategory = productLists.find(
      (entry: any) => entry?.category_data?.category === categoryToGet
    );
    return mainsubCategory?.category_data?.products ?? productLists;
  }

  if (Array.isArray(productLists?.products)) {
    const mainsubCategory = productLists.products.find(
      (entry: any) => entry?.category_data?.category === categoryToGet
    );
    return mainsubCategory?.category_data?.products ?? [];
  }

  return Object.keys(productLists).map((tierKey) => {
    const tierItems = productLists?.[tierKey] ?? [];
    const firstTierItem = tierItems[0] ?? {};

    return {
      sku: firstTierItem?.sku ?? tierKey,
      name: firstTierItem?.name ?? tierKey,
      description: firstTierItem?.description,
      variants: tierItems.map((item: any) => ({
        id: item?.v_id ?? item?.id,
        name: item?.meta_data?.cycle ?? item?.variant_name ?? item?.name,
        price: item?.price,
        metadata: item?.meta_data ?? {},
        billing_cycle: item?.billing_cycle,
        store_product_id: item?.store_product_id ?? '',
      })),
    };
  });

};

export class mediaHandler {
  public static handleSelectFromGallery = async (sacr: ImageLibraryOptions): Promise<Asset[] | null> => {
    try {
      const result = await launchImageLibrary(sacr);

      if (result.assets && result.assets.length > 0) {
        const media = result.assets;
        return media;
      }
      return null;
    } catch (error:any) {
      xxa_logggingReport({ type: "media", useraction: "select media error", logMessage: error?.message  });
      Toastx.show({ type: 'error', message: 'Failed to select media' });
      return null;
    }
  };

}

export class uploadHandler {
  public static requestPresignedURL_Upload = async (extension: string, bucketType: string, convoId?: string) => {
    // Build request body with meta wrapper
    const requestBody: any = {
      meta: {
        extension: extension,
        bucketType: bucketType,
      }
    };

    // Add convoId if it's a conversation type
    if (bucketType?.startsWith('convo') && convoId) {
      requestBody.meta.convoId = convoId;
    }

    const data = await xxa__http_requests({
      customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + "/api/core/v1/handleFileUpload",
      reqType: 'POST',
      bodyArray: requestBody
    });
    console.log("Received file upload response:", data);
    if (data?.code !== 200 || !data?.data?.uploadUrl) {
      throw new Error(data?.message ?? 'Unable to generate upload URL.4');
    }
    return data.data;
  };

  public static joinPath(...parts: string[]): string {
    return parts
      .map(p => p.replace(/^\/+|\/+$/g, "")) // trim slashes
      .filter(Boolean)
      //.map(segment => encodeURIComponent(segment))
      .join("/")
  }
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise(rv => setTimeout(rv, ms));
};
