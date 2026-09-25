import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import appjson from '../../../app.json';
import { cacheStorage } from '../functions.ts';
import { namer, __CONFIG__ } from '../static.ts';
import { sessionManager } from '../SessionContext.tsx';

const LOG_ENDPOINT = '/api/core/v1/pushLogReport';
const QUEUE_KEY = namer.storage.applog;
// Cap the on-device backlog so a long offline stretch can't grow it forever --
// keep the newest entries, drop the oldest on overflow.
const MAX_QUEUED_LOGS = 200;
// How many queued logs to ship per flush request.
const MAX_BATCH_SIZE = 50;

type LogPayload = Record<string, any>;

// user_id of the signed-in account, read from the session JWT's payload (the
// server signs { user_id }), or null when signed out. Stamped on each log when
// it's created: the server credits a log to an account only if this matches the
// session it arrives with, so a log from a signed-out moment -- or another
// account -- is never pinned on whoever is signed in at flush time.
const sessionUserId = (): string | null => {
  try {
    const token = sessionManager.getCurrentSession()?.x_omi_payload;
    const payload = token?.split('.')?.[1];
    if (!payload) return null;
    // atob is provided by Hermes (RN 0.74+); RN's TS lib just doesn't declare it.
    const json = (globalThis as any).atob(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
    );
    return JSON.parse(json)?.user_id ?? null;
  } catch {
    return null;
  }
};

// Serialises every read-modify-write on the queue so concurrent failed sends
// don't clobber each other's append. Network calls stay OUTSIDE this chain.
let queueChain: Promise<unknown> = Promise.resolve();
const withQueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queueChain.then(fn, fn);
  queueChain = next.catch(() => undefined);
  return next;
};

const readQueue = async (): Promise<LogPayload[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = async (items: LogPayload[]): Promise<void> => {
  try {
    if (!items.length) {
      await AsyncStorage.removeItem(QUEUE_KEY);
      return;
    }
    const trimmed =
      items.length > MAX_QUEUED_LOGS ? items.slice(-MAX_QUEUED_LOGS) : items;
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage unavailable -- nothing sensible to do, drop silently.
  }
};

const enqueueLog = (logD: LogPayload): Promise<void> =>
  withQueue(async () => {
    const queue = await readQueue();
    queue.push(logD);
    await writeQueue(queue);
  });

// POSTs one log object (legacy shape) or an array of them. `scripts` still
// carries the payload as a JSON string; the API now accepts object or array.
// Returns true only on a 2xx response.
const sendLogs = async (
  payload: LogPayload | LogPayload[],
): Promise<boolean> => {
  const res = await fetch(__CONFIG__.HTTPS_API_DOMAIN + LOG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-omi-Auth': sessionManager.getCurrentSession()?.x_omi_payload ?? '',
    },
    body: JSON.stringify({
      action: 'generateLogStats',
      scripts: JSON.stringify(payload),
    }),
  });
  return res.ok;
};

let flushing = false;
// Drains the offline queue to the server in batches. Safe to call on every app
// open / resume: it no-ops when the queue is empty or a flush is already
// running. Works signed in or out -- logs don't need an account. Any batch that
// fails to send is left in place and retried on the next call.
export const flushLogQueue = async (): Promise<void> => {
  if (flushing) return;
  flushing = true;
  try {
    let guard = 0;
    while (guard++ < 20) {
      const batch = (await withQueue(readQueue)).slice(0, MAX_BATCH_SIZE);
      if (!batch.length) break;

      let ok = false;
      try {
        ok = await sendLogs(batch);
      } catch {
        ok = false;
      }
      if (!ok) break; // still offline / server down -- keep the queue for later

      // Drop exactly what we shipped; anything appended meanwhile survives.
      await withQueue(async () => {
        const current = await readQueue();
        await writeQueue(current.slice(batch.length));
      });
    }
  } finally {
    flushing = false;
  }
};

// Log function for debugging
export const xxa_logggingReport = ({
  type,
  extra,
  useraction,
  url,
  logMessage,
}: {
  type: string;
  extra?: string;
  useraction: string;
  url?: string;
  logMessage: string;
}): void => {
  async function getAppMeta() {
    const [FirstInstallTime, LastUpdateTime] = await Promise.all([
      DeviceInfo.getFirstInstallTime(),
      DeviceInfo.getLastUpdateTime(),
    ]);

    return {
      version_app: DeviceInfo.getVersion(),
      buildNumber_app: DeviceInfo.getBuildNumber(),
      displayName_app: DeviceInfo.getApplicationName(),
      displayName_bundle: appjson.name,
      appPackageName: DeviceInfo.getBundleId(),
      appVersionName: DeviceInfo.getReadableVersion(),
      FirstInstallTime,
      LastUpdateTime,
    };
  }
  (async () => {
    try {
      const deviceData = await cacheStorage.getDeviceData();
      const logD = {
        type: type,
        _error: {
          url: url,
          useraction: useraction,
          description: logMessage,
          extras: extra,
        },
        // Device details live in users_devices (registered once via
        // registerDevice on app init) -- only the reference is sent here,
        // not the full device payload, on every single log.
        device_id: deviceData?.InstallationId || deviceData?.Id,
        // who was signed in when this happened (null = nobody) -- see sessionUserId
        uid: sessionUserId(),
        app: await getAppMeta(),
        // When this log was created on-device -- preserved through an offline
        // spell so the server sees the original time, not the flush time.
        queued_at: new Date().toISOString(),
      };

      let sent = false;
      try {
        // console.log('logReport:', logD);
        sent = await sendLogs(logD);
      } catch (e: any) {
        // console.log('logReport fetch error:', e.message);
        logD._error.extras =
          (logD._error.extras ?? '') +
          ' |||| logReport fetch error: ' +
          e?.message;
      }

      if (!sent) {
        // Offline or the server rejected it -- stash it and move on. It goes
        // out on the next flushLogQueue() (app open / next successful log).
        await enqueueLog(logD);
      } else {
        // Piggyback: a working connection is a good moment to drain any
        // backlog left over from an earlier offline stretch.
        flushLogQueue();
      }
    } catch (error: any) {
      console.error('logReport: fetching device info', error.message);
    }
  })();
};
