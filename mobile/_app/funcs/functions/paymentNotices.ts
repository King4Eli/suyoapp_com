import { Linking } from 'react-native';
import { Dialogx } from '../customDialog';
import { _http_request, navigationRef } from '../functions';
import { namer, __CONFIG__ } from '../static';
import { cacheStorage } from './llstorage';

// Payment/subscription events, in the words the server wrote for this user
// (api global/paymentNotices.js) -- "Welcome to Plus!", "We couldn't renew VIP",
// "10 direct messages added" -- instead of a generic "payment updated".

export type PaymentNotice = {
  id: string;
  kind: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  title: string;
  body: string;
  paymentId?: string | null;
};

// Events about the plan itself -- tapping them opens Settings, where the
// subscription card lives.
const SUBSCRIPTION_KINDS = new Set([
  'subscription_activated',
  'subscription_processing',
  'subscription_payment_failed',
  'subscription_renewed',
  'subscription_renewal_failed',
  'subscription_ended_unpaid',
  'subscription_cancel_scheduled',
  'subscription_resumed',
  'subscription_ended',
]);

// Ids already shown this session: a notice can arrive over the socket and again
// from getPaymentNotices/getPaymentStatus before it's marked seen.
const shown = new Set<string>();

// Events the app already told the user about itself (e.g. Settings confirms a
// cancellation immediately) -- the webhook's notice for the same thing, arriving
// seconds later, is skipped instead of shown twice.
const alreadyToldUntil = new Map<string, number>();
export function markNoticeAlreadyShown(kind: string, forMs = 2 * 60 * 1000) {
  alreadyToldUntil.set(kind, Date.now() + forMs);
}

// A purchase that just went through: the user is done with the payment screen.
const COMPLETED_KINDS = new Set([
  'subscription_activated',
  'purchase_completed',
  'rewind_completed',
]);
const PAYMENT_ROUTES = new Set<string>([
  namer.navigation.subscription,
  namer.navigation.consumables,
]);

/** Leaves the subscription / consumables screen, if that's where the user is. */
export function leavePaymentScreens() {
  if (!navigationRef.isReady()) return;
  const current = navigationRef.getCurrentRoute()?.name ?? '';
  if (PAYMENT_ROUTES.has(current) && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

// Screens that show plan-gated UI but only read the profile on mount (Settings,
// preferences, ...) re-read it when a payment lands -- by then the cache is fresh.
const refreshListeners = new Set<() => void>();
export function onPaymentRefreshed(listener: () => void) {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
}
export function notifyPaymentRefreshed() {
  refreshListeners.forEach(listener => {
    try {
      listener();
    } catch {
      // one screen's failed refresh shouldn't stop the others
    }
  });
}

const openSettings = () => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(namer.navigation.settings as never);
  }
};

// Icons that say more than the tone's default for a few key events.
const KIND_ICON: Record<string, string> = {
  subscription_activated: 'diamond',
  subscription_renewed: 'refresh-circle',
  purchase_completed: 'gift',
  rewind_completed: 'arrow-undo-circle',
  rewind_refunded: 'cash',
  payment_refunded: 'cash',
  subscription_processing: 'time',
  purchase_processing: 'time',
};

// Payment events always matter to the user, so they're dialogs, not toasts.
export function presentPaymentNotice(notice: PaymentNotice) {
  if (!notice?.title || (notice.id && shown.has(notice.id))) return;
  if (notice.id) shown.add(notice.id);
  if ((alreadyToldUntil.get(notice.kind) ?? 0) > Date.now()) {
    alreadyToldUntil.delete(notice.kind);
    return;
  }
  if (COMPLETED_KINDS.has(notice.kind)) leavePaymentScreens();
  const isPlan = SUBSCRIPTION_KINDS.has(notice.kind);
  const needsAction = notice.tone === 'error' || notice.tone === 'warning';

  Dialogx.alert(
    notice.title,
    notice.body,
    needsAction && isPlan
      ? [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ]
      : [
          {
            text:
              notice.kind === 'subscription_activated'
                ? "Let's go"
                : needsAction
                ? 'OK'
                : 'Got it',
          },
        ],
    { tone: notice.tone, icon: KIND_ICON[notice.kind] },
  );
}

/** Refreshes what payment events change: plan, perks, balances, products. */
async function refreshAfterPayment() {
  await Promise.all([
    cacheStorage.getCurrentUserProfile(true).catch(() => {}),
    cacheStorage.getProducts(true).catch(() => {}),
  ]);
  notifyPaymentRefreshed();
}

/**
 * Shows every payment event the user hasn't seen yet. Called on launch, when the
 * app comes back to the foreground, and when the socket pings "payment-event".
 */
export async function checkPaymentNotices() {
  try {
    const res: any = await _http_request({
      customApiUrl:
        __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getPaymentNotices',
      reqType: 'POST',
    });
    const notices: PaymentNotice[] = Array.isArray(res?.notices)
      ? res.notices
      : [];
    if (notices.length === 0) return;
    await refreshAfterPayment();
    notices.forEach(presentPaymentNotice);
  } catch {
    // Not worth interrupting the user over -- the next check picks them up.
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(() => r(), ms));

/**
 * After Stripe checkout returns to the app: wait for the webhook to settle this
 * payment, then show exactly what happened to it. The redirect usually beats the
 * webhook by a second or two, so this polls briefly.
 */
export async function followCheckoutReturn(paymentId: string | null) {
  if (!paymentId) {
    // Older checkout links carry no payment id -- fall back to any new notices.
    await sleep(3000);
    await checkPaymentNotices();
    return;
  }
  const deadline = Date.now() + 25000;
  let last: any = null;
  while (Date.now() < deadline) {
    try {
      last = await _http_request({
        customApiUrl:
          __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getPaymentStatus',
        reqType: 'POST',
        bodyArray: { paymentId },
      });
    } catch {
      last = null;
    }
    if (last?.code === 200 && last.status !== 'pending' && last.notice) break;
    if (last?.code === 200 && ['failed', 'expired'].includes(last.status))
      break;
    await sleep(2500);
  }

  await refreshAfterPayment();

  if (last?.notice) {
    presentPaymentNotice(last.notice);
  } else if (last?.status === 'completed') {
    leavePaymentScreens();
    Dialogx.alert(
      'Payment received',
      'Your purchase is confirmed.',
      undefined,
      {
        tone: 'success',
      },
    );
  } else if (last?.status === 'failed') {
    Dialogx.alert(
      "Payment didn't go through",
      "You haven't been charged. Please try again or use another payment method.",
      undefined,
      { tone: 'error' },
    );
  } else {
    // Still with Stripe (or we couldn't reach the server) -- the webhook will
    // finish it, and the notice will show on the next check.
    Dialogx.alert(
      'Confirming your payment',
      "This is taking a little longer than usual. We'll let you know as soon as it's done -- you don't need to pay again.",
      [{ text: 'Got it' }],
      { tone: 'info', icon: 'time' },
    );
  }
}

/**
 * A checkout that couldn't start (pay.js subscribe/onetime), explained by its
 * `reason` rather than a generic "payment error".
 */
export function presentCheckoutError(res: any) {
  const message: string | undefined = res?.message;
  switch (res?.reason) {
    case 'already_subscribed':
      Dialogx.alert(
        'You already have this plan',
        message,
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
        { tone: 'info', icon: 'diamond' },
      );
      return;
    case 'manage_in_store':
      Dialogx.alert('Managed by your app store', message, undefined, {
        tone: 'info',
        icon: 'storefront',
      });
      return;
    case 'email_required':
      Dialogx.alert(
        'Add your email first',
        message,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
        { tone: 'warning', icon: 'mail' },
      );
      return;
  }
  if (!res) {
    Dialogx.alert(
      "Couldn't reach us",
      'Check your internet connection and try again.',
      undefined,
      { tone: 'error', icon: 'cloud-offline' },
    );
    return;
  }
  Dialogx.alert(
    res?.code === 503 ? 'Payments are busy' : "Couldn't start checkout",
    message ?? 'Something went wrong on our side. Please try again.',
    undefined,
    { tone: 'error' },
  );
}

/** Opens a Stripe-hosted page (checkout / billing portal), explaining failures. */
export async function openPaymentPage(url: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Dialogx.alert(
      "Couldn't open the payment page",
      'Please check that a web browser is installed and try again.',
      undefined,
      { tone: 'error' },
    );
    return false;
  }
}
