import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SocketClient } from './socket_realtimeData';

// Socket events meaning "your likes/chats changed" (api global/badges.js
// pushBadgeCounts emits lists-changed on every change), plus reconnects, after
// which pushes sent while offline are gone and a resync is needed.
const CHANGE_EVENTS = new Set([
  'lists-changed',
  'new-like',
  'new-match',
  'message-deleted',
  'connect',
]);

/**
 * Keeps a list screen fresh from the socket instead of refetching on every
 * visit: loads once on mount, then reloads only when the server says something
 * changed -- right away if the screen is showing, otherwise the next time it's
 * opened. Also resyncs after the app returns to the foreground.
 * @param id unique listener id (one per screen)
 * @param load fetches and applies the list
 */
export function useLiveRefresh(id: string, load: () => void) {
  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  const dirtyRef = useRef(false);
  const loadRef = useRef(load);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  loadRef.current = load;
  focusedRef.current = isFocused;

  // Several events often arrive together (e.g. new-like + lists-changed) --
  // collapse them into one reload.
  const scheduleLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      loadRef.current();
    }, 300);
  }, []);

  const markChanged = useCallback(() => {
    if (focusedRef.current) scheduleLoad();
    else dirtyRef.current = true;
  }, [scheduleLoad]);

  useEffect(() => {
    loadRef.current();
    SocketClient.addListener(id, (data: any) => {
      if (CHANGE_EVENTS.has(data?.event)) markChanged();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') markChanged();
    });
    return () => {
      SocketClient.removeListener(id);
      appState.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, markChanged]);

  useFocusEffect(
    useCallback(() => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        scheduleLoad();
      }
    }, [scheduleLoad]),
  );
}
