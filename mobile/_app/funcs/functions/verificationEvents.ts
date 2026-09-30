import { Dialogx } from '../customDialog';
import { navigationRef } from '../functions';
import { namer } from '../static';
import { cacheStorage } from './llstorage';

// Selfie verification results (api global/notifyEmail.js "verification-event"):
// an admin approved or rejected the selfie. The cached profile is refreshed so the
// verified badge shows, open screens that read it re-read it, and the user is told.

export type VerificationEvent = {
  status: 'verified' | 'rejected';
  reason?: string | null;
};

const listeners = new Set<() => void>();
/** Profile / ProfileVerify re-read their state when a review lands. */
export function onVerificationChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function handleVerificationEvent(event: VerificationEvent) {
  try {
    await cacheStorage.getCurrentUserProfile(true);
  } catch {
    // listeners still re-fetch on their own below
  }
  listeners.forEach(listener => {
    try {
      listener();
    } catch {
      // one screen's failed refresh shouldn't stop the others
    }
  });

  if (event?.status === 'verified') {
    Dialogx.alert(
      "You're verified!",
      'Your profile now shows the verified badge.',
      undefined,
      { tone: 'success', icon: 'checkmark-circle' },
    );
  } else if (event?.status === 'rejected') {
    const onVerifyScreen =
      navigationRef.isReady() &&
      navigationRef.getCurrentRoute()?.name === namer.navigation.verifyProfile;
    Dialogx.alert(
      "Your selfie wasn't approved",
      event.reason
        ? `${event.reason}\n\nYou can take a new selfie and try again.`
        : 'You can take a new selfie and try again.',
      onVerifyScreen
        ? undefined
        : [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Try again',
              onPress: () =>
                navigationRef.isReady() &&
                navigationRef.navigate(namer.navigation.verifyProfile),
            },
          ],
      { tone: 'warning', icon: 'camera' },
    );
  }
}
