import { Alert, Linking } from 'react-native';
import { _http_request, navigationRef } from '../functions';
import { namer, __CONFIG__ } from '../static';
import { Toastx } from '../customNotification';
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

const openSettings = () => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(namer.navigation.settings as never);
  }
};

export function presentPaymentNotice(notice: PaymentNotice) {
  if (!notice?.title || (notice.id && shown.has(notice.id))) return;
  if (notice.id) shown.add(notice.id);
  const isPlan = SUBSCRIPTION_KINDS.has(notice.kind);

  // Something needs the user's attention -- a dialog, not a toast that slides away.
  if (notice.tone === 'error' || notice.tone === 'warning') {
    Alert.alert(
      notice.title,
      notice.body,
      isPlan
        ? [
            { text: 'Later', style: 'cancel' },
            { text: 'Open Settings', onPress: openSettings },
          ]
        : [{ text: 'OK' }],
    );
    return;
  }
  Toastx.show({
    title: notice.title,
    message: notice.body,
    type: notice.tone === 'success' ? 'success' : 'info',
    duration: 9000,
    onPress: isPlan ? openSettings : undefined,
  });
}

/** Refreshes what payment events change: plan, perks, balances, products. */
async function refreshAfterPayment() {
  await Promise.all([
    cacheStorage.getCurrentUserProfile(true).catch(() => {}),
    cacheStorage.getProducts(true).catch(() => {}),
  ]);
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
    Toastx.show({
      type: 'success',
      title: 'Payment received',
      message: 'Your purchase is confirmed.',
      duration: 8000,
    });
  } else if (last?.status === 'failed') {
    Alert.alert(
      "Payment didn't go through",
      "You haven't been charged. Please try again or use another payment method.",
    );
  } else {
    // Still with Stripe (or we couldn't reach the server) -- the webhook will
    // finish it, and the notice will show on the next check.
    Toastx.show({
      type: 'info',
      title: 'Confirming your payment',
      message:
        "This is taking a little longer than usual. We'll let you know as soon as it's done.",
      duration: 9000,
    });
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
      Alert.alert('You already have this plan', message, [
        { text: 'OK', style: 'cancel' },
        { text: 'Open Settings', onPress: openSettings },
      ]);
      return;
    case 'manage_in_store':
      Alert.alert('Managed by your app store', message);
      return;
    case 'email_required':
      Alert.alert('Add your email first', message, [
        { text: 'Later', style: 'cancel' },
        { text: 'Open Settings', onPress: openSettings },
      ]);
      return;
  }
  if (!res) {
    Alert.alert(
      "Couldn't reach us",
      'Check your internet connection and try again.',
    );
    return;
  }
  Alert.alert(
    res?.code === 503 ? 'Payments are busy' : "Couldn't start checkout",
    message ?? 'Something went wrong on our side. Please try again.',
  );
}

/** Opens a Stripe-hosted page (checkout / billing portal), explaining failures. */
export async function openPaymentPage(url: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(
      "Couldn't open the payment page",
      'Please check that a web browser is installed and try again.',
    );
    return false;
  }
}
