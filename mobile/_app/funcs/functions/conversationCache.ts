import AsyncStorage from '@react-native-async-storage/async-storage';

// Conversations kept on the device so opening a chat shows it instantly and only
// the difference is fetched (getConversation with `since`). Keyed per signed-in
// user + match, so another account on the same phone never sees them.
//
// Only messages the server has confirmed are stored. Messages the app made up
// itself (optimistic sends, socket previews) carry `local: true` and are replaced
// by the server's copies on the next sync.

const KEY_PREFIX = 'convo:v1:';
// Enough history to scroll back through offline; older pages come from the server.
const MAX_CACHED_MESSAGES = 300;

export type CachedConversation = {
  messages: any[];
  u2deets: any;
  syncedAt: number; // server time of the last sync (unix seconds)
};

const keyFor = (userId: string, matchId: string) =>
  `${KEY_PREFIX}${userId}:${matchId}`;

export async function readConversationCache(
  userId: string | null | undefined,
  matchId: string | null | undefined,
): Promise<CachedConversation | null> {
  if (!userId || !matchId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, matchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.messages) && Number(parsed?.syncedAt) > 0
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function writeConversationCache(
  userId: string | null | undefined,
  matchId: string | null | undefined,
  data: CachedConversation,
) {
  if (!userId || !matchId) return;
  try {
    const messages = data.messages
      .filter(m => !m?.local && !m?.status && !m?.isUploading)
      .slice(0, MAX_CACHED_MESSAGES);
    await AsyncStorage.setItem(
      keyFor(userId, matchId),
      JSON.stringify({ ...data, messages }),
    );
  } catch {
    // A failed write just means the next open does a full fetch.
  }
}

export async function clearConversationCache(
  userId: string | null | undefined,
  matchId: string | null | undefined,
) {
  if (!userId || !matchId) return;
  await AsyncStorage.removeItem(keyFor(userId, matchId)).catch(() => {});
}

/**
 * Merges a server response into what's on screen (newest first). Server messages
 * replace same-id ones; local placeholders are dropped unless still unsent
 * (sending / failed), since the server now has the real copies.
 */
export function mergeServerMessages(current: any[], incoming: any[]): any[] {
  const byId = new Map<string, any>();
  for (const m of current) {
    if (m?.local && !m?.status) continue;
    byId.set(m.messageId, m);
  }
  for (const m of incoming) byId.set(m.messageId, m);
  return [...byId.values()].sort((a, b) => {
    // Unsent local messages stay on top, where they were typed.
    if (a?.local !== b?.local) return a?.local ? -1 : 1;
    return Number(b?.dateAdded ?? 0) - Number(a?.dateAdded ?? 0);
  });
}
