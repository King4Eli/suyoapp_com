// The user's boost state (api global/entitlements.js getBoostStatus), kept in
// one place so every screen showing it agrees. Filled from each profile load
// (llstorage) and from pushBoost's reply. Times are absolute ISO strings, so a
// stale cached profile still counts down correctly.

export type BoostStatus = {
  balance: number;
  activeUntil: string | null;
  minutes: number;
  weekly: { available: boolean; nextAt: string | null } | null;
};

let status: BoostStatus | null = null;
const listeners = new Set<() => void>();
const endListeners = new Set<() => void>();
let endTimer: ReturnType<typeof setTimeout> | null = null;

export const getBoostState = () => status;

export function subscribeBoost(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called once when a running boost reaches its end while the app is open. */
export function onBoostEnded(listener: () => void) {
  endListeners.add(listener);
  return () => {
    endListeners.delete(listener);
  };
}

export function setBoostState(next: BoostStatus | null | undefined) {
  if (!next) return;
  status = next;
  if (endTimer) clearTimeout(endTimer);
  endTimer = null;
  const msLeft = next.activeUntil
    ? new Date(next.activeUntil).getTime() - Date.now()
    : 0;
  if (msLeft > 0) {
    endTimer = setTimeout(() => {
      endTimer = null;
      listeners.forEach(l => l());
      endListeners.forEach(l => l());
    }, msLeft + 500);
  }
  listeners.forEach(l => l());
}
