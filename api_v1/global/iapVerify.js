import crypto from "crypto";
import { tools } from "./functions.js";

// --------------------------------------------------------------------------------------------
// Native (App Store / Play Store) purchase verification.
//
// Real credentials for either store (App Store Connect API key, Google Play service account)
// aren't configured yet -- see .env/iap.env. Until they are, verification falls back to a
// "pseudo" mode that trusts the structurally-decoded transaction from the client without
// checking Apple/Google's signature, which is fine for exercising the flow against Sandbox/
// internal-test purchases but must never run in production. That's why the pseudo fallback
// is hard-disabled whenever NODE_ENV === 'production'.
// --------------------------------------------------------------------------------------------

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function base64UrlDecode(segment) {
  const padded = segment
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(segment.length + ((4 - (segment.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function base64UrlEncode(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Decodes a JWS's payload without checking its signature. Only ever used to read fields
 * for the pseudo fallback, or after a real server has already vouched for the transaction. */
function decodeJwsPayload(jws) {
  const parts = String(jws ?? "").split(".");
  if (parts.length !== 3) throw new Error("Malformed JWS");
  return JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

const APPLE_KEY_ID = process.env.APPLE_APP_STORE_KEY_ID ?? "";
const APPLE_ISSUER_ID = process.env.APPLE_APP_STORE_ISSUER_ID ?? "";
const APPLE_PRIVATE_KEY = (
  process.env.APPLE_APP_STORE_PRIVATE_KEY ?? ""
).replace(/\\n/g, "\n");
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? "com.vintolab.suyoapp";
const appleConfigured = Boolean(
  APPLE_KEY_ID && APPLE_ISSUER_ID && APPLE_PRIVATE_KEY,
);

function signAppleServerJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: APPLE_KEY_ID, typ: "JWT" };
  const payload = {
    iss: APPLE_ISSUER_ID,
    iat: now,
    exp: now + 300,
    aud: "appstoreconnect-v1",
    bid: APPLE_BUNDLE_ID,
  };
  const signingInput = `${base64UrlEncode(Buffer.from(JSON.stringify(header)))}.${base64UrlEncode(Buffer.from(JSON.stringify(payload)))}`;
  const signature = crypto.sign(null, Buffer.from(signingInput), {
    key: APPLE_PRIVATE_KEY,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Looks up a transaction via Apple's App Store Server API when credentials are configured,
 * otherwise (non-production only) decodes the client-supplied transaction JWS directly.
 * @param {string} transactionId
 * @param {string} signedTransactionJws - the `purchaseToken` react-native-iap returns on iOS (StoreKit2 JWS)
 */
export async function verifyAppleTransaction(
  transactionId,
  signedTransactionJws,
) {
  if (appleConfigured) {
    const jwt = signAppleServerJwt();
    for (const host of [
      "https://api.storekit.itunes.apple.com",
      "https://api.storekit-sandbox.itunes.apple.com",
    ]) {
      const resp = await fetch(
        `${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
        {
          headers: { Authorization: `Bearer ${jwt}` },
        },
      );
      if (resp.status === 404) continue; // not found here, try sandbox host
      if (!resp.ok) {
        tools.serverLog(
          `Apple App Store Server API error ${resp.status} for transaction ${transactionId}`,
          "iap-apple-0",
        );
        throw new Error(`Apple verification failed with status ${resp.status}`);
      }
      /** @type any */
      const body = await resp.json();
      const info = decodeJwsPayload(body.signedTransactionInfo);
      return {
        verified: true,
        mode: "verified",
        productId: info.productId,
        transactionId: info.transactionId,
        originalTransactionId: info.originalTransactionId,
        expiresAtMs: info.expiresDate ?? null,
        purchaseDateMs: info.purchaseDate ?? null,
        environment: info.environment,
        raw: body,
      };
    }
    throw new Error(
      "Transaction not found in production or sandbox App Store Server API",
    );
  }

  if (IS_PRODUCTION) {
    throw new Error(
      "Apple IAP verification is not configured (APPLE_APP_STORE_KEY_ID/ISSUER_ID/PRIVATE_KEY missing)",
    );
  }

  tools.serverLog(
    `PSEUDO-MODE (unverified): trusting client-supplied Apple transaction ${transactionId}`,
    "iap-apple-pseudo",
  );
  const info = decodeJwsPayload(signedTransactionJws);
  return {
    verified: false,
    mode: "pseudo",
    productId: info.productId,
    transactionId: info.transactionId ?? transactionId,
    originalTransactionId: info.originalTransactionId ?? transactionId,
    expiresAtMs: info.expiresDate ?? null,
    purchaseDateMs: info.purchaseDate ?? null,
    environment: info.environment ?? "Sandbox",
    raw: info,
  };
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

const GOOGLE_SERVICE_ACCOUNT_EMAIL =
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL ?? "";
const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = (
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY ?? ""
).replace(/\\n/g, "\n");
const GOOGLE_PACKAGE_NAME =
  process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "com.vintolab.suyoapp";
const googleConfigured = Boolean(
  GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
);

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 300,
  };
  const signingInput = `${base64UrlEncode(Buffer.from(JSON.stringify(header)))}.${base64UrlEncode(Buffer.from(JSON.stringify(payload)))}`;
  const signature = crypto.sign(
    "RSA-SHA256",
    Buffer.from(signingInput),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
  const assertion = `${signingInput}.${base64UrlEncode(signature)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!resp.ok)
    throw new Error(
      `Google OAuth token exchange failed with status ${resp.status}`,
    );
  /** @type any */
  const body = await resp.json();
  return body.access_token;
}

/**
 * @param {string} productId - store product id (subscription or one-time product)
 * @param {string} purchaseToken
 * @param {boolean} isSubscription
 */
export async function verifyGooglePurchase(
  productId,
  purchaseToken,
  isSubscription,
) {
  if (googleConfigured) {
    const accessToken = await getGoogleAccessToken();
    const path = isSubscription
      ? `purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
      : `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const resp = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PACKAGE_NAME)}/${path}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!resp.ok) {
      tools.serverLog(
        `Google Play Developer API error ${resp.status} for token ${purchaseToken}`,
        "iap-google-0",
      );
      throw new Error(`Google verification failed with status ${resp.status}`);
    }
    /** @type any */
    const body = await resp.json();

    if (isSubscription) {
      const lineItem = body.lineItems?.[0];
      const expiresAtMs = lineItem?.expiryTime
        ? Date.parse(lineItem.expiryTime)
        : null;
      const isActive =
        body.subscriptionState === "SUBSCRIPTION_STATE_ACTIVE" ||
        body.subscriptionState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD";
      return {
        verified: true,
        mode: "verified",
        productId: lineItem?.productId ?? productId,
        isActive,
        expiresAtMs,
        raw: body,
      };
    }
    // purchaseState: 0=purchased,1=canceled,2=pending
    return {
      verified: true,
      mode: "verified",
      productId,
      isActive: body.purchaseState === 0,
      expiresAtMs: null,
      raw: body,
    };
  }

  if (IS_PRODUCTION) {
    throw new Error(
      "Google IAP verification is not configured (GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY missing)",
    );
  }

  tools.serverLog(
    `PSEUDO-MODE (unverified): trusting client-supplied Google purchase for ${productId}`,
    "iap-google-pseudo",
  );
  return {
    verified: false,
    mode: "pseudo",
    productId,
    isActive: true,
    expiresAtMs: null,
    raw: { purchaseToken },
  };
}
