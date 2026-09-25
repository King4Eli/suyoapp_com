import AsyncStorage from '@react-native-async-storage/async-storage';
import { namer } from '../static';
import { cacheStorage } from './llstorage';
import { sessionManager } from '../SessionContext';

// The API stamps every response with X-Api-Build (its commit sha, "dev" for
// local builds). Cached server data -- mapper, products, profile, chats -- was
// filled by whichever build answered at the time; when a different build shows
// up, that data may be stale or shaped differently, so it's dropped and the
// essentials are refetched in the background.

let knownBuild: string | null = null;
let checking: Promise<void> | null = null;

/**
 * Called by the HTTP layer with each response's X-Api-Build header.
 * Cheap when nothing changed (in-memory compare); only a real change touches
 * storage.
 */
export function noteApiBuild(header: unknown): Promise<void> | void {
  const build = typeof header === 'string' ? header.trim() : '';
  if (!build || build === knownBuild) return;
  if (checking) return checking;

  checking = (async () => {
    try {
      const stored = await AsyncStorage.getItem(namer.storage.apiBuild);
      if (stored !== build) {
        // First launch after this feature (nothing stored) counts as a change
        // too: those caches predate any build tracking.
        await cacheStorage.clearServerCaches();
        await AsyncStorage.setItem(namer.storage.apiBuild, build);
        knownBuild = build;
        refetchEssentials();
      } else {
        knownBuild = build;
      }
    } catch {
      // Storage trouble: try again on the next response.
    } finally {
      checking = null;
    }
  })();
  return checking;
}

// Refill what the app reads synchronously right after launch; everything else
// refills itself on next use.
function refetchEssentials() {
  cacheStorage.getMapper(true).catch(() => {});
  // The rest are signed-in endpoints -- calling them signed out would 401.
  if (!sessionManager.getCurrentSession()?.x_omi_payload) return;
  cacheStorage.CONFIG.getMapper(true).catch(() => {});
  cacheStorage.getProducts(true).catch(() => {});
  cacheStorage.getCurrentUserProfile(true).catch(() => {});
}

/**
 * The API build this app last talked to, short form for display ("1a2b3c4",
 * or "dev"). Null until the first API response has been seen.
 */
export async function getApiBuild(): Promise<string | null> {
  const build =
    knownBuild ??
    (await AsyncStorage.getItem(namer.storage.apiBuild).catch(() => null));
  if (!build) return null;
  return /^[0-9a-f]{40}$/i.test(build) ? build.slice(0, 7) : build;
}
