import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  Dimensions,
  PermissionsAndroid,
  Platform,
  Vibration,
} from 'react-native';
import { Dialogx } from './customDialog';
import { sessionManager } from './SessionContext';
import Geolocation from 'react-native-geolocation-service';
import ngeohash from 'ngeohash';
import { namer, __CONFIG__ } from './static';
import {
  Asset,
  ImageLibraryOptions,
  launchImageLibrary,
} from 'react-native-image-picker';
import { Toastx } from './customNotification';
import { SocketClient } from './socket_realtimeData';
import { applyBadgeCounts, chatsBadge, likesBadge } from './tabBadges';
import { createNavigationContainerRef } from '@react-navigation/native';
import { xxa_logggingReport, flushLogQueue } from './functions/logging';
import {
  xxa__http_requests,
  getFriendlyNetworkErrorMessage,
} from './functions/httpRequest';
import { cacheStorage } from './functions/llstorage';
import { reportUser } from './functions/reportUser';
import {
  checkPaymentNotices,
  followCheckoutReturn,
} from './functions/paymentNotices';

export { cacheStorage };
export { xxa_logggingReport as logReport };
export { xxa__http_requests as _http_request };
export { getFriendlyNetworkErrorMessage };
export { reportUser };

export const { width: screenWidth, height: screenHeight } =
  Dimensions.get('window');
export const navigationRef = createNavigationContainerRef<any>();

// Helper functions for encoding/decoding
export const help = {
  randomInt(minOrMax: number, max?: number) {
    const min = max !== undefined ? minOrMax : 0;
    const maxVal = max !== undefined ? max : minOrMax;

    return Math.floor(Math.random() * (maxVal - min + 1)) + min;
  },

  randomAlphanumeric: (
    max: number,
    min: number = 6,
    upperCase: boolean = false,
  ) => {
    const chars =
      (upperCase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '') +
      'abcdefghijklmnopqrstuvwxyz0123456789';

    const length = Math.floor(Math.random() * (max - min + 1)) + min;

    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
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
      xxa_logggingReport({
        type: 'function',
        extra: 'yyyymmdd' + yyyymmdd,
        useraction: 'getageFromDOB',
        logMessage: e?.message,
      });
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
      xxa_logggingReport({
        type: 'function',
        extra: 'age: ' + age,
        useraction: 'getDOBFromAge',
        logMessage: e?.message,
      });
      return null;
    }
  },
  cmToFtIn: (cmValue: number) => {
    try {
      if (isNaN(cmValue)) return null;

      const inches = cmValue / 2.54;
      const feet = Math.floor(inches / 12);
      const remainingInches = Math.round(inches % 12);

      return `${feet}ft' ${remainingInches}in`;
    } catch (e: any) {
      xxa_logggingReport({
        type: 'function',
        extra: 'cmValue ' + cmValue,
        useraction: 'cmToFtIn',
        logMessage: e?.message,
      });
      return null;
    }
  },
  milesToKM: (milesValue: number) => {
    try {
      if (isNaN(milesValue)) return null;

      const km = milesValue * 1.60934;

      return km;
    } catch (e: any) {
      xxa_logggingReport({
        type: 'function',
        extra: 'milesToKM: ' + milesValue,
        useraction: 'milestokm',
        logMessage: e?.message,
      });
      return null;
    }
  },
  timeAgo: (unixSeconds: string) => {
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
  // UI gating only -- the server enforces every feature itself (api
  // global/entitlements.js). `features` comes straight from the server's
  // entitlements so the app never works out access from the product name.
  getSubscriptionState: (profile: any) => {
    const rawPlan = profile?.subscription?.product_name ?? null;
    const rawVariant = profile?.subscription?.plan_name ?? null;
    const hasActive = Boolean(profile?.subscription?.status === 'active');
    const tier: 'free' | 'plus' | 'vip' = profile?.entitlements?.tier ?? 'free';
    const f = profile?.entitlements?.features ?? {};
    const features = {
      unlimitedLikes: f.unlimitedLikes === true,
      seeWhoLikedYou: f.seeWhoLikedYou === true,
      advancedFilters: f.advancedFilters === true,
      freeRewind: f.freeRewind === true,
      readReceipts: f.readReceipts === true,
      viewSocialLinks: f.viewSocialLinks === true,
      travelMode: f.travelMode === true,
      dailyRoses: Number(f.dailyRoses ?? 0),
      dailyDirectMessages: Number(f.dailyDirectMessages ?? 0),
    };

    return {
      hasActive,
      plan: rawPlan,
      variant: rawVariant,
      tier,
      isPlus: tier === 'plus',
      isVip: tier === 'vip',
      features,
    };
  },
};

let paymentNoticeWatcher: { remove: () => void } | null = null;

export const __init__app = async (): Promise<void> => {
  // get mapper (public -- no session needed)
  await cacheStorage.CONFIG.getMapper();

  // ship any logs that couldn't be delivered earlier -- no session needed, so
  // signed-out devices (e.g. stuck on signup) still report their errors
  flushLogQueue();

  // get session and verify
  const getSession_omi = sessionManager.getCurrentSession()?.x_omi_payload;
  const notSessionAndNavigation = !getSession_omi || navigationRef === null;

  // Everything below hits authenticated endpoints -- bail if we're logged out,
  // otherwise a logged-out launch spams the API with 400 "Authentication token
  // is required" (registerDevice/pushLocation/socket handshake).
  if (!getSession_omi) {
    if (navigationRef === null) return;
    Toastx.show({ message: 'Session not found.', type: 'info' });
    return;
  }

  // register/refresh this device once per app session -- logs then reference
  // device_id instead of re-sending the full device payload every time
  cacheStorage.registerDevice();

  // pending likes / unread chats counts for the bottom tab badges
  likesBadge.refresh();
  chatsBadge.refresh();

  // payment events that happened while the app was closed (renewals, failed
  // payments, refunds...), and again whenever it comes back to the foreground
  checkPaymentNotices();
  if (!paymentNoticeWatcher) {
    paymentNoticeWatcher = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      checkPaymentNotices();
      // Pushes sent while the socket was down are gone -- resync the badges.
      likesBadge.refresh();
    });
  }

  // 111111
  // update location -- gated so a re-launch in the same neighborhood doesn't
  // re-hit the server (and its reverse-geocode call) every single time. Not
  // awaited: the GPS fix itself can take several seconds and nothing the user
  // sees on launch depends on it, so it shouldn't hold up the splash screen.
  maybePushLocation().catch((error: any) =>
    console.error('maybePushLocation failed:', error?.message),
  );

  // 222222
  // connect with socket for realtime info
  (async () => {
    // console.log(
    // `🟨 [INIT] socket-connect step -> notSessionAndNavigation=${notSessionAndNavigation}`,
    // );
    if (notSessionAndNavigation) {
      Toastx.show({
        message: 'Session not found.',
        type: 'info',
      });
      return;
    }

    try {
      const getProfile = await cacheStorage.getCurrentUserProfile();
      const userId = getProfile?.profile?.id;
      // console.log(
      // `🟨 [INIT] socket-connect step -> gotProfile=${Boolean(
      // getProfile,
      // )} userId=${userId}`,
      // );
      if (!userId) return;
      SocketClient.connect(userId, data => {
        const retrivedData = data?.message;
        if (data.event === 'message') {
          if (retrivedData?.type !== 'single-convo') return;
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
              if (navigationRef.isReady())
                navigationRef.setParams({
                  realtimedata: retrivedData?.payload,
                });
            } else {
              chatsBadge.refresh();
            }
          } else {
            chatsBadge.refresh();
            const nmessage =
              (retrivedData?.payload?.firstName ?? 'Someone') +
              ' has messaged you';
            if (AppState.currentState === 'active') {
              Vibration.vibrate(100);
              Toastx.show({
                title: nmessage,
                message: 'Tap to view message',
                type: 'info',
                onPress: () => {
                  if (navigationRef.isReady())
                    navigationRef.navigate(namer.navigation.conversation, {
                      matchId: retrivedData?.matchId,
                    });
                },
              });
            } else if (
              AppState.currentState === 'background' ||
              AppState.currentState === 'inactive'
            ) {
              //displsyNotification(nmessage, "Tap to view message");
            }
          }
        } else if (data.event === 'new-like') {
          // Emitted by pushPeopleToMatch.js when someone likes/superlikes the current user.
          // Re-counted rather than incremented -- a like upgraded to a superlike is still one person.
          likesBadge.refresh();
          if (navigationRef.getCurrentRoute()?.name === namer.navigation.likes)
            return;
          if (AppState.currentState === 'active') {
            Vibration.vibrate(100);
            Toastx.show({
              title: `${data.fromUserName ?? 'Someone'} ${
                data.isSuperlike ? 'super liked' : 'liked'
              } you!`,
              message: "Tap to see who's interested",
              type: 'info',
              onPress: () => {
                if (navigationRef.isReady())
                  navigationRef.navigate(namer.navigation.likes);
              },
            });
          }
        } else if (data.event === 'badge-counts') {
          // Pushed by the server whenever a tab badge changes (api global/badges.js).
          applyBadgeCounts(data);
        } else if (data.event === 'payment-event') {
          // Emitted by the Stripe webhook (api global/paymentNotices.js). Fetched
          // rather than shown from the payload so it's marked seen server-side.
          checkPaymentNotices();
        } else if (data.event === 'message-deleted') {
          // Emitted by pushDeleteMessage.js -- a deleted unread last message no longer counts as unread.
          chatsBadge.refresh();
        } else if (data.event === 'new-match') {
          // Emitted by pushPeopleToMatch.js to the party who liked first, once the other
          // side matches back -- they don't otherwise learn about it until they reopen the app.
          const navigationRef_route = navigationRef.getCurrentRoute();
          if (
            navigationRef_route?.name === namer.navigation.conversation &&
            (navigationRef_route.params as { matchId?: string } | undefined)
              ?.matchId === data.matchId
          )
            return;
          if (AppState.currentState === 'active') {
            Vibration.vibrate(100);
            Toastx.show({
              title: `It's a match with ${data.fromUserName ?? 'someone'}!`,
              message: 'Tap to say hi',
              type: 'success',
              onPress: () => {
                if (navigationRef.isReady())
                  navigationRef.navigate(namer.navigation.conversation, {
                    matchId: data.matchId,
                  });
              },
            });
          }
        }
      });
    } catch (error: any) {
      // console.log(
      // `🔴 [INIT] socket-connect step FAILED -> ${
      // error?.message || String(error)
      // }`,
      // );
      xxa_logggingReport({
        type: 'function',
        useraction: 'initSocketConnect',
        logMessage: error?.message || String(error),
      });
    }
  })();
};

export function handleDeepLink(url: string) {
  if (!url) return;

  try {
    const match = url.match(/^(\w+):\/\/([^/]+)(\/.*)?$/);
    if (!match) return;
    const [, _scheme, _host, rawPath = '/'] = match;
    // clean path
    const path = rawPath.split('?')[0].replace(/\/$/, '') || '/';

    const query = rawPath.split('?')[1] ?? '';
    const paymentId =
      query
        .split('&')
        .map(pair => pair.split('='))
        .find(([key]) => key === 'pid')?.[1] ?? null;

    // Checkout returns: each shows what actually happened to that payment (see
    // functions/paymentNotices.ts), not a blanket "payment successful".
    const paymentRoutes: Record<string, () => void> = {
      '/payment/success': () => {
        Toastx.show({
          type: 'info',
          title: 'Confirming your payment…',
          message: 'Hang tight, this only takes a moment.',
          duration: 4000,
        });
        followCheckoutReturn(paymentId ? decodeURIComponent(paymentId) : null);
      },
      '/payment/cancelled': () => {
        Toastx.show({
          type: 'info',
          title: 'Checkout cancelled',
          message:
            "You weren't charged. You can pick up where you left off anytime.",
          duration: 7000,
        });
      },
      '/payment/billing': () => {
        // Back from Stripe's billing portal -- a card update may have retried a
        // failed renewal, so pick up whatever that produced.
        checkPaymentNotices();
        cacheStorage.getCurrentUserProfile(true).catch(() => {});
      },
    };

    const handler = paymentRoutes[path];

    if (handler) {
      handler();
    } else {
      // console.log('No route match:', host, path);
    }
  } catch (error) {
    console.error('Deep link error:', error);
  }
}

// Handle login
export const _handle_Signin = async (
  phoneNumber: string,
  callingCode: string,
  vscode: string | null,
): Promise<{ code: number; message?: string; redirect?: string }> => {
  let err: string | null = null;
  if (!vscode || vscode.length < 6) {
    if (phoneNumber.length <= 5) {
      err = 'Invalid username or password!.';
    }
    //
    if (err === null) {
      const loginRes = await xxa__http_requests({
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/login',
        reqType: 'POST',
        bodyArray: {
          cc: callingCode,
          user_phone: phoneNumber,
        },
      });
      if (loginRes?.code === 200) {
        await sessionManager.updateSession({
          x_omi_payload: '',
        });
        return {
          code: 200,
          message: loginRes?.message ?? 'Login sus',
        };
      } else if (loginRes?.code === 404) {
        return {
          code: 404,
          message: 'redirecting to signup',
          redirect: 'signup',
        };
      } else {
        err = loginRes?.message ?? 'Error logging in!';
      }
    }
  } else if (vscode && vscode.length >= 6) {
    if (err === null) {
      try {
        const loginRes = await fetch(
          __CONFIG__.HTTPS_API_DOMAIN + '/api/login',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_phone: phoneNumber,
              cc: callingCode,
              vcode: vscode,
            }),
          },
        );

        const headers = loginRes.headers;
        const response = await loginRes.json();

        if (response?.code === 200) {
          const auth = headers.get('x-omi-auth') ?? '';

          await AsyncStorage.setItem(namer.storage.sessionId, auth);
          await sessionManager.updateSession({
            x_omi_payload: auth,
          });

          return {
            code: 200,
            message: 'Login success',
          };
        } else {
          err = response?.message ?? 'Error logging in!';
        }
      } catch (error: any) {
        err = await getFriendlyNetworkErrorMessage(error, 'Error logging in!');
      }
    }
  }

  // Login failed
  return {
    code: 400,
    message: err ?? 'Error signing in function.',
  };
};

// Handle signup
export const _handle_Signup = async (
  textInput_: { verifypassword: string; password: string; email: string },
  get_setuserId: (uid: string) => void,
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
      },
    });
    if (signupRes?.code === 200) {
      const uid = signupRes?.user_id ?? '';
      if (uid !== '') {
        //await AsyncStorage.setItem(namer.userId, uid);
        get_setuserId(uid);
      }
    } else {
      err = signupRes?.message ?? 'Account not created!';
    }
  }
  if (err) {
    Dialogx.alert('Signup failed', err, undefined, { tone: 'error' });
  }
};

// Get current location with permission handling
export async function getCurrentLocation() {
  //get locations
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
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
      },
    );
  });
}

const LOCATION_PUSH_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // refresh at least once a day even if stationary
const LOCATION_GEOHASH_PRECISION = 6; // (~0.6km x 1.2km) or ( ~0.375mi x 0.75mi) cell -- roughly neighborhood-scale

/**
 * Pushes location to the server only when the device has actually left the
 * neighborhood it was last pushed from, or enough time has passed since the last
 * push. Skips the round-trip otherwise -- pushLocation's handler does a reverse-geocode
 * call against a rate-limited third-party API plus a DB write, neither of which should
 * run on every single app launch just because the phone hasn't moved.
 *
 * `force` skips that check (the user tapped "refresh"). Resolves to the server's
 * resolved place ({ city, state, country, ... }) when a push happened, else null.
 */
export async function maybePushLocation({
  force = false,
}: { force?: boolean } = {}): Promise<any | null> {
  const location: any = await getCurrentLocation().catch(() => null);
  if (!location) return null;

  const latd = location?.coords?.latitude;
  const long = location?.coords?.longitude;
  if (!Number.isFinite(latd) || !Number.isFinite(long)) return null;

  const geohash = ngeohash.encode(latd, long, LOCATION_GEOHASH_PRECISION);

  try {
    const lastRaw = await AsyncStorage.getItem(namer.storage.lastLocationPush);
    if (lastRaw) {
      const last = JSON.parse(lastRaw);
      const isSameArea = last?.geohash === geohash;
      const isFresh =
        Date.now() - (last?.pushedAt ?? 0) < LOCATION_PUSH_MIN_INTERVAL_MS;
      if (!force && isSameArea && isFresh) return null;
    }
  } catch (error) {
    console.error('Error reading last location push:', error);
  }

  const cords = {
    latd,
    long,
    accuracy: location.coords.accuracy,
    altitude: location.coords.altitude,
    altitudeAccuracy: location.coords.altitudeAccuracy,
    heading: location.coords.heading,
    speed: location.coords.speed,
    timestamp: location.timestamp,
  };

  const response = await xxa__http_requests({
    customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushLocation',
    reqType: 'POST',
    bodyArray: { longlatd: JSON.stringify(cords) },
  });

  if (response?.code === 200) {
    await AsyncStorage.setItem(
      namer.storage.lastLocationPush,
      JSON.stringify({ geohash, pushedAt: Date.now() }),
    );
    await cacheStorage.getCurrentUserProfile(true);
    return response?.data ?? null;
  }
  return null;
}

export const parseCategoryProducts = (
  productLists: any = false,
  categoryToGet: string,
) => {
  if (!productLists) return [];

  if (Array.isArray(productLists)) {
    const mainsubCategory = productLists.find(
      (entry: any) => entry?.category_data?.category === categoryToGet,
    );
    return mainsubCategory?.category_data?.products ?? productLists;
  }

  if (Array.isArray(productLists?.products)) {
    const mainsubCategory = productLists.products.find(
      (entry: any) => entry?.category_data?.category === categoryToGet,
    );
    return mainsubCategory?.category_data?.products ?? [];
  }

  return Object.keys(productLists).map(tierKey => {
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
  public static handleSelectFromGallery = async (
    sacr: ImageLibraryOptions,
  ): Promise<Asset[] | null> => {
    try {
      const result = await launchImageLibrary(sacr);

      if (result.assets && result.assets.length > 0) {
        const media = result.assets;
        return media;
      }
      return null;
    } catch (error: any) {
      xxa_logggingReport({
        type: 'media',
        useraction: 'select media error',
        logMessage: error?.message,
      });
      Toastx.show({ type: 'error', message: 'Failed to select media' });
      return null;
    }
  };
}

export class uploadHandler {
  public static requestPresignedURL_Upload = async (
    extension: string,
    bucketType: string,
    convoId?: string,
  ) => {
    // Build request body with meta wrapper
    const requestBody: any = {
      meta: {
        extension: extension,
        bucketType: bucketType,
      },
    };

    // Add convoId if it's a conversation type
    if (bucketType?.startsWith('convo') && convoId) {
      requestBody.meta.convoId = convoId;
    }

    const data = await xxa__http_requests({
      customApiUrl:
        __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/handleFileUpload',
      reqType: 'POST',
      bodyArray: requestBody,
    });
    // console.log('Received file upload response:', data);
    if (data?.code !== 200 || !data?.data?.uploadUrl) {
      throw new Error(data?.message ?? 'Unable to generate upload URL.4');
    }
    return data.data;
  };

  public static joinPath(...parts: string[]): string {
    return (
      parts
        .map(p => p.replace(/^\/+|\/+$/g, '')) // trim slashes
        .filter(Boolean)
        //.map(segment => encodeURIComponent(segment))
        .join('/')
    );
  }

  // Bucket-relative object key, persisted as `p` and rendered as
  public static resolveObjectPath(presigned: any): string {
    if (presigned?.objectPath) return presigned.objectPath;
    return '/' + uploadHandler.joinPath(presigned?.fileKey ?? '');
  }

  // Headers for the presigned PUT. `uploadHeaders` carries X-S3Bender-Public
  // for world-readable uploads.
  public static uploadHeaders(
    presigned: any,
    contentType: string,
  ): Record<string, string> {
    return { 'Content-Type': contentType, ...(presigned?.uploadHeaders ?? {}) };
  }
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise(rv => setTimeout(rv, ms));
};
