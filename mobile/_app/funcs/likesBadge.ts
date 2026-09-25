import { useSyncExternalStore } from 'react';
import { __CONFIG__ } from './static';
import { _http_request } from './functions';

// Pending likes count (people who liked/superliked the current user and are
// still waiting on a response) shown as the Likes tab badge. Refreshed on app
// init and on the 'new-like' socket event; the Likes screen sets it directly
// from the list it already fetched.
let count = 0;
const subscribers = new Set<() => void>();

export const likesBadge = {
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
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getLikes',
      });
      if (Array.isArray(response?.likedlist)) {
        likesBadge.set(response.likedlist.length);
      }
    } catch (error: any) {
      console.error('likesBadge.refresh failed:', error?.message);
    }
  },
  subscribe(notify: () => void) {
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  },
};

export const useLikesBadgeCount = () =>
  useSyncExternalStore(likesBadge.subscribe, likesBadge.get);
