import { stripe_gateway, tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

// Where Stripe sends the browser after checkout. These are the website's pages,
// which the app's verified links (AndroidManifest /payment/success|cancelled) open
// straight into the app; `pid` lets the app look up exactly this payment's outcome.
const RETURN_BASE_URL = (
  process.env.PAYMENT_RETURN_BASE_URL || "https://suyoapp.com"
).replace(/\/$/, "");

// Checkout links stay valid this long; the webhook marks the payment expired after.
const CHECKOUT_TTL_SECONDS = 60 * 60;

// Bank debits and Cash App can complete checkout before the money clears -- the
// webhook holds fulfillment until checkout.session.async_payment_succeeded.
const PAYMENT_METHOD_TYPES = ["card", "us_bank_account", "cashapp"];

function normalizedDurationFunc(cycle = -1) {
  // 1'once',2'weekly',3'biweekly',4'monthly',5'yearly',

  if (cycle === 3) {
    return { name: "week", d: 2 };
  } else if (cycle === 5) {
    return { name: "year", d: 1 };
  } else if (cycle === 2) {
    return { name: "week", d: 1 };
  } else if (cycle === 4) {
    return { name: "month", d: 1 };
  }
  return null;
}
function normalizedPriceFunc(price = "") {
  // Remove any non-numeric characters except for the decimal point
  // convert to a float and then to cents (integer)
  // eg. "19.99" -> 1999, "$19.99" -> 1999, "19,99" -> 1999
  try {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return null;
    }
    return Math.round(parsedPrice * 100); // Convert to cents
  } catch (e) {
    // @ts-ignore
    tools.serverLog(e?.message, "gateway-0");
    return null;
  }
}

/**
 * Stripe's error, as something the user can act on. Raw Stripe messages are logged,
 * never shown -- they can mention API keys, parameters or internal ids.
 * @param {any} err
 * @returns {{ code: number; message: string; retryable: boolean }}
 */
export function describeStripeError(err) {
  switch (err?.type) {
    case "StripeConnectionError":
    case "StripeAPIError":
      return {
        code: 503,
        message:
          "We couldn't reach our payment provider. Check your connection and try again.",
        retryable: true,
      };
    case "StripeRateLimitError":
      return {
        code: 503,
        message: "Payments are busy right now. Please try again in a minute.",
        retryable: true,
      };
    case "StripeCardError":
      return {
        code: 402,
        message: err?.message || "Your card was declined.",
        retryable: false,
      };
    case "StripeAuthenticationError":
    case "StripePermissionError":
    case "StripeInvalidRequestError":
    default:
      return {
        code: 502,
        message:
          "Payments are temporarily unavailable. We've been notified -- please try again later.",
        retryable: false,
      };
  }
}

/**
 * Creates a hosted checkout session. Retries only errors worth retrying, and uses
 * the paymentId as idempotency key so a retry after a lost response returns the
 * same session instead of opening a second one.
 * @param {"subscription" | "payment"} mode
 * @param {{ productName: string; unitAmount: number; recurring?: any; userEmail: string; metadata: Record<string, string>; paymentId: string }} opts
 */
async function createCheckoutSession(mode, opts) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const session = await stripe_gateway.checkout.sessions.create(
        {
          mode,
          // @ts-ignore
          payment_method_types: PAYMENT_METHOD_TYPES,
          customer_email: opts.userEmail,
          client_reference_id: sessions?.currentUserID ?? undefined,
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: { name: opts.productName },
                unit_amount: opts.unitAmount,
                ...(opts.recurring ? { recurring: opts.recurring } : {}),
              },
              quantity: 1,
            },
          ],
          success_url: `${RETURN_BASE_URL}/payment/success?pid=${encodeURIComponent(opts.paymentId)}`,
          cancel_url: `${RETURN_BASE_URL}/payment/cancelled?pid=${encodeURIComponent(opts.paymentId)}`,
          expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS,
          metadata: opts.metadata,
          // Copied onto the subscription/payment intent so later events (renewals,
          // refunds) can be traced back without another lookup.
          ...(mode === "subscription"
            ? { subscription_data: { metadata: opts.metadata } }
            : { payment_intent_data: { metadata: opts.metadata } }),
        },
        { idempotencyKey: `checkout-${opts.paymentId}` },
      );
      if (!session?.url) {
        tools.serverLog(
          `Checkout session ${session?.id} created without a URL`,
          "gateway-1",
        );
        return { code: 502, message: describeStripeError(null).message };
      }
      return { code: 301, type: "external", url: session.url };
    } catch (stripeError) {
      const described = describeStripeError(stripeError);
      tools.serverLog(
        // @ts-ignore
        `Stripe ${mode} checkout attempt ${attempt} failed (${stripeError?.type}): ${stripeError?.message}`,
        "gateway-2",
      );
      if (!described.retryable || attempt === maxRetries) {
        return { code: described.code, message: described.message };
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 500),
      );
    }
  }
  return { code: 502, message: describeStripeError(null).message };
}

export default class GatewayPay {
  static async subscribe(
    host = "",
    sku = "",
    sku_variant = "",
    userEmail = "",
    productname = "",
    duration = -2,
    price = "",
    paymentId = "",
  ) {
    try {
      if (!sku || !sku_variant || !productname || !price || !paymentId) {
        tools.serverLog(
          `Subscription missing params: sku=${Boolean(sku)}, variant=${Boolean(sku_variant)}, product=${Boolean(productname)}, price=${Boolean(price)}, paymentId=${Boolean(paymentId)}`,
          "gateway-11",
        );
        return {
          code: 400,
          message: "This plan can't be purchased right now.",
        };
      }
      if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        return {
          code: 400,
          reason: "email_required",
          message:
            "Add a valid email address in Settings before subscribing -- we send your receipts there.",
        };
      }

      const normalizedPrice = normalizedPriceFunc(price);
      const normalizedDurationValue = normalizedDurationFunc(duration);
      if (!normalizedPrice || !normalizedDurationValue) {
        tools.serverLog(
          `Subscription bad price/duration: price=${price}, duration=${duration}`,
          "gateway-6",
        );
        return {
          code: 400,
          message: "This plan can't be purchased right now.",
        };
      }

      return await createCheckoutSession("subscription", {
        productName: productname,
        unitAmount: normalizedPrice,
        recurring: {
          interval: normalizedDurationValue.name,
          interval_count: normalizedDurationValue.d,
        },
        userEmail,
        paymentId,
        metadata: {
          userId: sessions?.currentUserID ?? "",
          sku,
          sku_variant: String(sku_variant),
          type: "subscription",
          paymentId,
          host,
        },
      });
    } catch (error) {
      tools.serverLog(
        `Unexpected error in subscription creation: ${error}`,
        "gateway-5",
      );
      return { code: 500, message: describeStripeError(error).message };
    }
  }

  static async onetime(
    host = "",
    sku = "",
    sku_variant = "",
    userEmail = "",
    productname = "",
    duration = "",
    price = "",
    paymentId = "",
    matchId = "",
  ) {
    try {
      if (!sku || !sku_variant || !productname || !price || !paymentId) {
        tools.serverLog(
          `One-time payment missing params: sku=${Boolean(sku)}, variant=${Boolean(sku_variant)}, product=${Boolean(productname)}, price=${Boolean(price)}, paymentId=${Boolean(paymentId)}, duration=${duration}`,
          "gateway-0",
        );
        return {
          code: 400,
          message: "This item can't be purchased right now.",
        };
      }
      if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        return {
          code: 400,
          reason: "email_required",
          message:
            "Add a valid email address in Settings before buying -- we send your receipts there.",
        };
      }

      const normalizedPrice = normalizedPriceFunc(price);
      if (!normalizedPrice) {
        tools.serverLog(
          `One-time payment invalid price: ${price}`,
          "gateway-0",
        );
        return {
          code: 400,
          message: "This item can't be purchased right now.",
        };
      }

      return await createCheckoutSession("payment", {
        productName: productname,
        unitAmount: normalizedPrice,
        userEmail,
        paymentId,
        metadata: {
          userId: sessions?.currentUserID ?? "",
          sku,
          sku_variant: String(sku_variant),
          type: "onetime",
          paymentId,
          host,
          ...(matchId ? { matchId } : {}),
        },
      });
    } catch (error) {
      tools.serverLog(
        `Unexpected error in one-time payment creation: ${error}`,
        "gateway-0",
      );
      return { code: 500, message: describeStripeError(error).message };
    }
  }
}
