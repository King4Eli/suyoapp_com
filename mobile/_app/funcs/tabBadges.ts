import { useSyncExternalStore } from 'react';
import { __CONFIG__ } from './static';
import { _http_request } from './functions';

// Counts shown as bottom-tab badges. The server pushes changes over the socket
// ("badge-counts", see api global/badges.js); refresh() pulls both counts from
// one small endpoint on launch/foreground or after a local action. Counts are
// capped at 10 by the server -- the tab shows "9+" beyond 9.
function createBadgeStore() {
  let count = 0;
  const subscribers = new Set<() => void>();

  const store = {
    get: () => count,
    set(next: number) {
      next = Math.max(0, Math.floor(next || 0));
      if (next === count) return;
      count = next;
      subscribers.forEach(notify => notify());
    },
    refresh: () => refreshBadgeCounts(),
    subscribe(notify: () => void) {
      subscribers.add(notify);
      return () => {
        subscribers.delete(notify);
      };
    },
  };
  return store;
}

export const countUnreadChats = (withmessages: any) =>
  Array.isArray(withmessages)
    ? withmessages.filter((chat: any) => chat?.last_message_read === false)
        .length
    : NaN;

// people who liked/superliked the current user and are still waiting on a response
export const likesBadge = createBadgeStore();

// conversations whose last message is from the other person and unread
export const chatsBadge = createBadgeStore();

/** Applies counts from getBadgeCounts or a "badge-counts" socket push. */
export function applyBadgeCounts(counts: { likes?: number; chats?: number }) {
  if (Number.isFinite(counts?.likes)) likesBadge.set(Number(counts.likes));
  if (Number.isFinite(counts?.chats)) chatsBadge.set(Number(counts.chats));
}

// Both badges come from one request; calls made while one is in flight share it.
let inFlight: Promise<void> | null = null;
export function refreshBadgeCounts(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const response: any = await _http_request({
        reqType: 'POST',
        customApiUrl:
          __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getBadgeCounts',
      });
      if (response?.code === 200) applyBadgeCounts(response);
    } catch (error: any) {
      console.error('badge refresh failed:', error?.message);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export const useBadgeCount = (store: typeof likesBadge) =>
  useSyncExternalStore(store.subscribe, store.get);
