import { useSyncExternalStore } from 'react';
import { __CONFIG__ } from './static';
import { _http_request } from './functions';

// Counts shown as bottom-tab badges. Each store refetches its own endpoint on
// refresh(); screens that already hold the list call set() directly instead.
function createBadgeStore(endpoint: string, countFrom: (response: any) => any) {
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
    async refresh() {
      try {
        const response: any = await _http_request({
          reqType: 'POST',
          customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + endpoint,
        });
        const next = countFrom(response);
        if (Number.isFinite(next)) store.set(next);
      } catch (error: any) {
        console.error(`badge refresh ${endpoint} failed:`, error?.message);
      }
    },
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
export const likesBadge = createBadgeStore('/api/core/v1/getLikes', response =>
  Array.isArray(response?.likedlist) ? response.likedlist.length : NaN,
);

// conversations whose last message is from the other person and unread
export const chatsBadge = createBadgeStore(
  '/api/core/v1/getChatLists',
  response => countUnreadChats(response?.chatsListings?.withmessages),
);

export const useBadgeCount = (store: typeof likesBadge) =>
  useSyncExternalStore(store.subscribe, store.get);
