import { Platform } from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  isUserCancelledError,
  type Purchase,
} from 'react-native-iap';
import { _http_request, cacheStorage } from './functions';
import { __CONFIG__ } from './static';

// Lazily connects once per app session; every caller awaits the same in-flight promise so
// concurrent purchase attempts don't race initConnection().
let connectionReady: Promise<boolean> | null = null;
function ensureConnection(): Promise<boolean> {
  if (!connectionReady) {
    connectionReady = initConnection().catch(err => {
      connectionReady = null;
      throw err;
    });
  }
  return connectionReady;
}

export type NativePurchaseRequest = {
  purchaseType: 'subscribe' | 'onetime';
  sku: string;
  variantId: number;
  /** product_list_variant.external_3rdparty_store_product_id -- absent until a pseudo/real store ID is set for this variant */
  storeProductId: string | null | undefined;
  matchId?: string;
};

export type NativePurchaseResult = {
  code: number;
  message?: string;
  paymentId?: string;
  verified?: boolean;
};

/**
 * Drives a native App Store / Play Store purchase end to end: requests the purchase,
 * waits for the store's event-based response, sends the transaction to the backend for
 * verification (`POST /api/secure/gateway/iap-verify`), and finishes the transaction only
 * once the backend has recorded it -- so a killed app before finishTransaction() still
 * leaves the purchase re-deliverable via getAvailablePurchases() on next launch.
 */
export async function purchaseNative({
  purchaseType,
  sku,
  variantId,
  storeProductId,
  matchId,
}: NativePurchaseRequest): Promise<NativePurchaseResult> {
  if (!storeProductId) {
    return {
      code: 400,
      message: 'This product is not available for in-app purchase yet.',
    };
  }

  try {
    await ensureConnection();
    await fetchProducts({
      skus: [storeProductId],
      type: purchaseType === 'subscribe' ? 'subs' : 'in-app',
    });
  } catch (err: any) {
    return { code: 500, message: err?.message ?? 'Unable to reach the store.' };
  }

  return new Promise(resolve => {
    let settled = false;
    const settle = (result: NativePurchaseResult) => {
      if (settled) return;
      settled = true;
      updatedSub.remove();
      errorSub.remove();
      resolve(result);
    };

    const updatedSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      if (settled || purchase.productId !== storeProductId) return;

      try {
        const verifyResult = await _http_request({
          customApiUrl: `${__CONFIG__.HTTPS_API_DOMAIN}/api/secure/gateway/iap-verify`,
          reqType: 'POST',
          bodyArray: {
            purchaseType,
            platform: Platform.OS === 'ios' ? 'apple' : 'google',
            sku,
            variantId,
            productId: storeProductId,
            transactionId: purchase.transactionId ?? purchase.id,
            purchaseToken: purchase.purchaseToken,
            ...(matchId ? { matchId } : {}),
          },
        });

        if (verifyResult?.code === 200) {
          await finishTransaction({
            purchase,
            isConsumable: purchaseType === 'onetime',
          });
          await Promise.all([
            cacheStorage.getCurrentUserProfile(true),
            purchaseType === 'onetime'
              ? cacheStorage.getProducts(true)
              : Promise.resolve(),
          ]);
        }

        settle(
          verifyResult ?? { code: 500, message: 'No response from server.' },
        );
      } catch (err: any) {
        settle({
          code: 500,
          message: err?.message ?? 'Failed to verify purchase.',
        });
      }
    });

    const errorSub = purchaseErrorListener(error => {
      settle(
        isUserCancelledError(error)
          ? { code: 499, message: 'Purchase cancelled.' }
          : { code: 500, message: error.message },
      );
    });

    requestPurchase({
      request: {
        apple: { sku: storeProductId },
        google: { skus: [storeProductId] },
      },
      type: purchaseType === 'subscribe' ? 'subs' : 'in-app',
    }).catch((err: any) =>
      settle({
        code: 500,
        message: err?.message ?? 'Failed to start purchase.',
      }),
    );
  });
}
