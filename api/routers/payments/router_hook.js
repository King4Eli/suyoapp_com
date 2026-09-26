import express from "express";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  logsApplication,
  payments,
  productListVariant,
  productLists,
  stripeEvents,
  subscriptions,
} from "../../db/schema.js";
import {
  grantBoosts,
  grantDirectMessages,
  grantRoses,
} from "../../global/entitlements.js";
import { stripe_gateway, tools } from "../../global/functions.js";
import { pushBadgeCounts } from "../../global/badges.js";
import {
  createPaymentNotice,
  describeVariant,
  formatDate,
  formatMoney,
} from "../../global/paymentNotices.js";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_SIGNING_SECRET ?? "";

// payments.status tinyint (see schema.js)
const PAYMENT_STATUS = {
  pending: 0,
  completed: 1,
  refunded: 2,
  failed: 3,
  expired: 4,
  processing: 5,
};
// subscriptions.status tinyint: 1=active, 2=past_due, 3=canceled, 4=trialing
const SUB_STATUS = { active: 1, pastDue: 2, canceled: 3, trialing: 4 };
// subscriptions.external_platform: 1=stripe
const STRIPE_PLATFORM = 1;

const webhook_router = express.Router();

webhook_router.post("/", async (req, res) => {
  const sigHeader = req.headers["stripe-signature"];
  const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  // @ts-ignore
  const reqBody = req?.rawBody ?? req.body;

  let event;

  try {
    if (!signature || !reqBody) {
      tools.serverLog(
        "Webhook validation failed: Missing signature or payload",
        "hook_135",
      );
      return res
        .status(400)
        .json({ code: 400, message: "Missing webhook signature or payload" });
    }

    if (!STRIPE_WEBHOOK_SECRET) {
      tools.serverLog("Webhook secret not configured", "hook_136");
      return res
        .status(500)
        .json({ code: 500, message: "Webhook configuration error" });
    }

    event = stripe_gateway.webhooks.constructEvent(
      reqBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    tools.serverLog(
      // @ts-ignore
      `Webhook signature verification failed: ${err.message}`,
      "hook_137",
    );
    return res
      .status(400)
      .json({ code: 400, message: "Webhook signature verification failed" });
  }

  // Claim the event so concurrent/duplicate deliveries are skipped. The claim is
  // released again if processing fails, so Stripe's retry actually reprocesses it
  // instead of being mistaken for a duplicate.
  try {
    await db
      .insert(stripeEvents)
      .values({ eventId: event.id, eventType: event.type });
  } catch {
    tools.serverLog(
      `Duplicate webhook event skipped: ${event.id}`,
      "hook_4857",
    );
    return res
      .status(200)
      .json({ code: 200, message: "Webhook already processed" });
  }

  let result;
  try {
    result = await processWebhookEvent(event, req.app.get("io"));
  } catch (error) {
    result = { success: false, error: String(error) };
  }

  if (result.success) {
    return res.status(200).json({
      code: 200,
      message:
        result.handled === false
          ? "Webhook received but not handled"
          : "Webhook processed successfully",
      eventType: event.type,
    });
  }

  tools.serverLog(
    `Webhook ${event.type} (${event.id}) failed, releasing for retry: ${result.error}`,
    "hook_138",
  );
  await db
    .delete(stripeEvents)
    .where(eq(stripeEvents.eventId, event.id))
    .catch((err) =>
      tools.serverLog(
        `Failed to release webhook event ${event.id}: ${err}`,
        "hook_138b",
      ),
    );
  return res
    .status(500)
    .json({ code: 500, message: "Webhook processing failed" });
});

// ── helpers ──────────────────────────────────────────────────────────────────

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Stripe read with a short retry for transient failures.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {string} what
 * @returns {Promise<T>}
 */
async function withStripeRetry(fn, what) {
  const maxRetries = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      tools.serverLog(
        `Stripe ${what} attempt ${attempt} failed: ${err}`,
        "hook_142",
      );
      if (attempt >= maxRetries) throw err;
      await sleep(Math.pow(2, attempt) * 500);
    }
  }
}

/** @param {any} value */
const idOf = (value) => (typeof value === "string" ? value : value?.id);

/**
 * Newer Stripe API versions moved invoice.subscription under
 * invoice.parent.subscription_details -- read both.
 * @param {any} invoice
 */
const invoiceSubscriptionId = (invoice) =>
  idOf(invoice?.parent?.subscription_details?.subscription) ??
  idOf(invoice?.subscription) ??
  null;

/**
 * Current period of a Stripe subscription; also moved onto its items in newer APIs.
 * @param {any} sub
 */
const subscriptionPeriod = (sub) => ({
  start:
    sub?.items?.data?.[0]?.current_period_start ??
    sub?.current_period_start ??
    0,
  end:
    sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end ?? 0,
});

/**
 * Local subscription row for a Stripe subscription id.
 * @param {string} externalId
 */
async function findLocalSubscription(externalId) {
  const [row] = await db
    .select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      variantId: subscriptions.variantIdRef,
      status: subscriptions.status,
      endDate: subscriptions.endDate,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.externalId, externalId),
        eq(subscriptions.externalPlatform, STRIPE_PLATFORM),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Validates a checkout session against the payment row pay.js created for it:
 * it must exist and belong to the same user and variant as the session metadata.
 * @param {any} session
 */
async function loadCheckout(session) {
  const md = session?.metadata ?? {};
  const paymentId = md.paymentId;
  const userId = md.userId;
  const variantId = Number(md.sku_variant);
  if (!paymentId || !userId || !variantId) {
    return { error: "Missing checkout metadata" };
  }
  const [payment] = await db
    .select({
      status: payments.status,
      userId: payments.userIdRef,
      variantId: payments.variantRef,
      amount: payments.pAmount,
      currency: payments.pCurrency,
    })
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);
  if (!payment) return { error: `Unknown payment ${paymentId}` };
  if (payment.userId !== userId || Number(payment.variantId) !== variantId) {
    return { error: `Checkout metadata doesn't match payment ${paymentId}` };
  }
  const expectedCents = Math.round(parseFloat(payment.amount) * 100);
  if (
    typeof session.amount_total === "number" &&
    session.amount_total !== expectedCents
  ) {
    // Prices are fixed server-side, so this is a bug worth hearing about -- but the
    // customer did pay what Stripe showed them, so they still get what they bought.
    tools.serverLog(
      `Checkout ${session.id} total ${session.amount_total} != expected ${expectedCents} for ${paymentId}`,
      "hook_150",
    );
  }
  return {
    paymentId,
    userId,
    variantId,
    matchId: md.matchId || undefined,
    payment,
  };
}

/**
 * Moves a payment between statuses only if it's currently in one of `from` --
 * the guard that keeps a purchase from being activated twice when both
 * checkout.session.completed and async_payment_succeeded arrive.
 * @param {string} paymentId
 * @param {number[]} from
 * @param {number} to
 * @param {string} [reference]
 * @param {any} [tx]
 */
async function transitionPayment(paymentId, from, to, reference, tx = db) {
  const [result] = await tx
    .update(payments)
    .set({
      status: to,
      ...(reference ? { pTransactionReference: reference } : {}),
    })
    .where(
      and(eq(payments.paymentId, paymentId), inArray(payments.status, from)),
    );
  return Number(result?.affectedRows ?? 0) > 0;
}

/**
 * Best-effort human reason from a payment intent's last error.
 * @param {string | undefined} paymentIntentId
 */
async function paymentFailureReason(paymentIntentId) {
  if (!paymentIntentId) return undefined;
  try {
    const pi = await stripe_gateway.paymentIntents.retrieve(paymentIntentId);
    return pi?.last_payment_error?.message ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {string} type
 * @param {string} userId
 * @param {Record<string, any>} data
 */
async function logPaymentIncident(type, userId, data) {
  try {
    await db.insert(logsApplication).values({
      reportId: tools.generateAlphanumeric(11, 30),
      reportType: type,
      reportData: JSON.stringify(data),
      reportStatus: 0,
      reportCurrentuser: userId,
    });
  } catch (err) {
    tools.serverLog(`Failed to log ${type}: ${err}`, "hook_151");
  }
}

// ── activation ───────────────────────────────────────────────────────────────

/**
 * Money has cleared for this checkout: create the subscription or deliver the
 * one-time purchase. Safe to call more than once for the same session.
 * @param {any} session
 * @param {Awaited<ReturnType<typeof loadCheckout>> & { paymentId: string }} ctx
 * @param {import("socket.io").Server | undefined} io
 */
async function activateCheckout(session, ctx, io) {
  const described = await describeVariant(ctx.variantId);

  if (session.mode === "subscription") {
    const subscriptionId = idOf(session.subscription);
    if (!subscriptionId)
      return { success: false, error: "Missing subscription ID" };
    if (await findLocalSubscription(subscriptionId)) return { success: true };

    const stripeSub = await withStripeRetry(
      () => stripe_gateway.subscriptions.retrieve(subscriptionId),
      "subscription retrieve",
    );
    const period = subscriptionPeriod(stripeSub);

    // Plans the user is switching away from (active Stripe subs other than this one).
    const previous = await db
      .select({
        id: subscriptions.id,
        externalId: subscriptions.externalId,
        variantId: subscriptions.variantIdRef,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, ctx.userId),
          eq(subscriptions.externalPlatform, STRIPE_PLATFORM),
          inArray(subscriptions.status, [
            SUB_STATUS.active,
            SUB_STATUS.pastDue,
          ]),
          ne(subscriptions.externalId, subscriptionId),
        ),
      );

    await db.transaction(async (tx) => {
      await tx.insert(subscriptions).values({
        id: tools.generateAlphanumeric(10, tools.randomInt(20, 50)),
        userId: ctx.userId,
        variantIdRef: ctx.variantId,
        startDate: sql`FROM_UNIXTIME(${period.start})`,
        endDate: sql`FROM_UNIXTIME(${period.end})`,
        externalPlatform: STRIPE_PLATFORM,
        externalId: subscriptionId,
        paymentIdRef: ctx.paymentId,
        status: SUB_STATUS.active,
      });
      await transitionPayment(
        ctx.paymentId,
        [
          PAYMENT_STATUS.pending,
          PAYMENT_STATUS.processing,
          PAYMENT_STATUS.expired,
        ],
        PAYMENT_STATUS.completed,
        subscriptionId,
        tx,
      );
    });

    // Switching plans: end the old one now (unused time credited) so the user is
    // never billed for two plans at once.
    let switchedFrom;
    for (const old of previous) {
      try {
        await withStripeRetry(
          () =>
            stripe_gateway.subscriptions.cancel(old.externalId, {
              prorate: true,
              invoice_now: true,
            }),
          "subscription cancel (plan switch)",
        );
      } catch (err) {
        tools.serverLog(
          `Plan switch: failed to cancel old subscription ${old.externalId} for ${ctx.userId}: ${err}`,
          "hook_152",
        );
        await logPaymentIncident("plan_switch_cancel_failed", ctx.userId, {
          oldSubscription: old.externalId,
          newSubscription: subscriptionId,
        });
      }
      await db
        .update(subscriptions)
        .set({ status: SUB_STATUS.canceled, canceledAt: sql`NOW()` })
        .where(eq(subscriptions.id, old.id));
      switchedFrom = (await describeVariant(old.variantId)).plan;
    }

    await createPaymentNotice(
      io,
      ctx.userId,
      "subscription_activated",
      {
        plan: described.plan,
        until: formatDate(period.end * 1000),
        switchedFrom,
      },
      ctx.paymentId,
    );
    tools.serverLog(
      `Subscription ${subscriptionId} activated for ${ctx.userId}`,
      "hook_897",
    );
    return { success: true };
  }

  // One-time purchase. Claim the payment first -- only the delivery that moves it
  // to completed grants anything.
  const paymentIntentId = idOf(session.payment_intent);
  const claimed = await transitionPayment(
    ctx.paymentId,
    [PAYMENT_STATUS.pending, PAYMENT_STATUS.processing, PAYMENT_STATUS.expired],
    PAYMENT_STATUS.completed,
    paymentIntentId ?? session.id,
  );
  if (!claimed) return { success: true };

  let outcome;
  try {
    outcome = await fulfillOnetimePurchase(
      String(ctx.variantId),
      ctx.userId,
      ctx.paymentId,
      ctx.matchId,
    );
  } catch (err) {
    // Put it back so Stripe's retry can deliver it.
    await transitionPayment(
      ctx.paymentId,
      [PAYMENT_STATUS.completed],
      ctx.payment.status,
    );
    return { success: false, error: `Fulfillment failed: ${err}` };
  }

  const amount = formatMoney(
    parseFloat(ctx.payment.amount),
    ctx.payment.currency ?? "USD",
  );
  if (outcome?.rewindFailed && paymentIntentId) {
    // Nothing to recover any more -- don't keep their money for it.
    try {
      await stripe_gateway.refunds.create(
        { payment_intent: paymentIntentId, reason: "requested_by_customer" },
        { idempotencyKey: `refund-rewind-${ctx.paymentId}` },
      );
      await transitionPayment(
        ctx.paymentId,
        [PAYMENT_STATUS.completed],
        PAYMENT_STATUS.refunded,
      );
      await createPaymentNotice(
        io,
        ctx.userId,
        "rewind_refunded",
        { amount },
        ctx.paymentId,
      );
    } catch (err) {
      tools.serverLog(
        `Rewind refund failed for ${ctx.paymentId}: ${err}`,
        "hook_153",
      );
      await logPaymentIncident("rewind_refund_failed", ctx.userId, {
        paymentId: ctx.paymentId,
        paymentIntentId,
      });
    }
    return { success: true };
  }

  if (described.category === "rewind") pushBadgeCounts(io, ctx.userId);
  await createPaymentNotice(
    io,
    ctx.userId,
    described.category === "rewind" ? "rewind_completed" : "purchase_completed",
    { item: described.item },
    ctx.paymentId,
  );
  tools.serverLog(`One-time payment completed: ${ctx.paymentId}`, "hook_8997");
  return { success: true };
}

// ── events ───────────────────────────────────────────────────────────────────

/**
 * @param {import("stripe").Stripe.Event} event
 * @param {import("socket.io").Server | undefined} io
 * @returns {Promise<{ success: boolean; handled?: boolean; error?: string }>}
 */
async function processWebhookEvent(event, io) {
  switch (event.type) {
    case "checkout.session.completed": {
      /** @type {any} */
      const session = event.data.object;
      const ctx = await loadCheckout(session);
      if ("error" in ctx) {
        // Retrying can't fix bad metadata -- record it for a human instead.
        tools.serverLog(`${ctx.error} (session ${session.id})`, "hook_140");
        await logPaymentIncident(
          "checkout_unmatched",
          session?.metadata?.userId ?? "",
          {
            sessionId: session.id,
            error: ctx.error,
          },
        );
        return { success: true };
      }

      if (
        session.payment_status === "paid" ||
        session.payment_status === "no_payment_required"
      ) {
        return activateCheckout(session, ctx, io);
      }

      // Bank debit / Cash App: checkout is done but the money hasn't cleared.
      // Activation waits for checkout.session.async_payment_succeeded.
      const moved = await transitionPayment(
        ctx.paymentId,
        [PAYMENT_STATUS.pending, PAYMENT_STATUS.expired],
        PAYMENT_STATUS.processing,
      );
      if (moved) {
        const described = await describeVariant(ctx.variantId);
        await createPaymentNotice(
          io,
          ctx.userId,
          session.mode === "subscription"
            ? "subscription_processing"
            : "purchase_processing",
          { plan: described.plan, item: described.item },
          ctx.paymentId,
        );
      }
      return { success: true };
    }

    case "checkout.session.async_payment_succeeded": {
      /** @type {any} */
      const session = event.data.object;
      const ctx = await loadCheckout(session);
      if ("error" in ctx) {
        tools.serverLog(`${ctx.error} (session ${session.id})`, "hook_140");
        return { success: true };
      }
      return activateCheckout(session, ctx, io);
    }

    case "checkout.session.async_payment_failed": {
      /** @type {any} */
      const session = event.data.object;
      const ctx = await loadCheckout(session);
      if ("error" in ctx) return { success: true };
      const moved = await transitionPayment(
        ctx.paymentId,
        [PAYMENT_STATUS.pending, PAYMENT_STATUS.processing],
        PAYMENT_STATUS.failed,
      );
      if (moved) {
        const described = await describeVariant(ctx.variantId);
        const reason = await paymentFailureReason(idOf(session.payment_intent));
        await createPaymentNotice(
          io,
          ctx.userId,
          session.mode === "subscription"
            ? "subscription_payment_failed"
            : "purchase_failed",
          { plan: described.plan, item: described.item, reason },
          ctx.paymentId,
        );
      }
      return { success: true };
    }

    case "checkout.session.expired": {
      /** @type {any} */
      const session = event.data.object;
      const paymentId = session?.metadata?.paymentId;
      // Abandoned checkout -- nothing was charged, so no notice, just bookkeeping.
      if (paymentId) {
        await transitionPayment(
          paymentId,
          [PAYMENT_STATUS.pending],
          PAYMENT_STATUS.expired,
        );
      }
      return { success: true };
    }

    case "invoice.payment_succeeded": {
      /** @type {any} */
      const invoice = event.data.object;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return { success: true, handled: false };

      const local = await findLocalSubscription(subscriptionId);
      if (!local) {
        // The first invoice is recorded by checkout handling. Any other invoice for
        // a subscription we don't know yet is a race with checkout -- fail so
        // Stripe retries once the subscription row exists.
        if (invoice.billing_reason === "subscription_create") {
          return { success: true };
        }
        return {
          success: false,
          error: `Unknown subscription ${subscriptionId}`,
        };
      }

      let periodEnd = Number(invoice?.lines?.data?.[0]?.period?.end ?? 0);
      if (!periodEnd) {
        const stripeSub = await withStripeRetry(
          () => stripe_gateway.subscriptions.retrieve(subscriptionId),
          "subscription retrieve",
        );
        periodEnd = subscriptionPeriod(stripeSub).end;
      }

      const isRenewal = invoice.billing_reason !== "subscription_create";
      let recorded = false;
      await db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({
            endDate: sql`FROM_UNIXTIME(${periodEnd})`,
            status: SUB_STATUS.active,
          })
          .where(eq(subscriptions.id, local.id));

        if (!isRenewal || !invoice.id) return;
        const [existing] = await tx
          .select({ id: payments.paymentId })
          .from(payments)
          .where(eq(payments.pTransactionReference, invoice.id))
          .limit(1);
        if (existing) return;
        await tx.insert(payments).values({
          paymentId: `pay${tools.generateAlphanumeric(10, tools.randomInt(20, 50))}`,
          type: 1,
          userIdRef: local.userId,
          pAmount: String((invoice.amount_paid ?? 0) / 100),
          pCurrency: String(invoice.currency ?? "usd").toUpperCase(),
          variantRef: local.variantId,
          status: PAYMENT_STATUS.completed,
          pTransactionReference: invoice.id,
        });
        recorded = true;
      });

      if (recorded && (invoice.amount_paid ?? 0) > 0) {
        const described = await describeVariant(local.variantId);
        await createPaymentNotice(io, local.userId, "subscription_renewed", {
          plan: described.plan,
          amount: formatMoney(
            (invoice.amount_paid ?? 0) / 100,
            invoice.currency,
          ),
          until: formatDate(periodEnd * 1000),
        });
      }
      return { success: true };
    }

    case "invoice.payment_failed": {
      /** @type {any} */
      const invoice = event.data.object;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return { success: true, handled: false };
      // A failed first payment is reported through the checkout events instead.
      if (invoice.billing_reason === "subscription_create")
        return { success: true };

      const local = await findLocalSubscription(subscriptionId);
      if (!local) {
        return {
          success: false,
          error: `Unknown subscription ${subscriptionId}`,
        };
      }

      const nextAttempt = invoice.next_payment_attempt;
      const finalFailure = !nextAttempt;
      await db
        .update(subscriptions)
        .set({
          status: finalFailure ? SUB_STATUS.canceled : SUB_STATUS.pastDue,
        })
        .where(eq(subscriptions.id, local.id));
      await logPaymentIncident("payment_failed", local.userId, {
        subscriptionId,
        invoiceId: invoice.id,
        attempt: invoice.attempt_count ?? 0,
      });

      const described = await describeVariant(local.variantId);
      await createPaymentNotice(
        io,
        local.userId,
        finalFailure
          ? "subscription_ended_unpaid"
          : "subscription_renewal_failed",
        {
          plan: described.plan,
          retryOn: nextAttempt ? formatDate(nextAttempt * 1000) : undefined,
        },
      );
      return { success: true };
    }

    case "customer.subscription.updated": {
      /** @type {any} */
      const subscription = event.data.object;
      /** @type {any} */
      const previous = event.data.previous_attributes ?? {};
      const local = await findLocalSubscription(subscription.id);
      if (!local) return { success: true, handled: false };

      /** @type {Record<string, number>} */
      const STRIPE_TO_LOCAL_STATUS = {
        trialing: SUB_STATUS.trialing,
        active: SUB_STATUS.active,
        past_due: SUB_STATUS.pastDue,
        unpaid: SUB_STATUS.canceled,
        canceled: SUB_STATUS.canceled,
        incomplete_expired: SUB_STATUS.canceled,
      };
      const mappedStatus = STRIPE_TO_LOCAL_STATUS[subscription.status] ?? null;
      const cancelFlag = subscription.cancel_at_period_end ? 1 : 0;
      const periodEnd = subscriptionPeriod(subscription).end;

      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: cancelFlag,
          canceledAt:
            cancelFlag && !local.cancelAtPeriodEnd
              ? sql`NOW()`
              : sql`canceled_at`,
          ...(mappedStatus ? { status: mappedStatus } : {}),
          ...(periodEnd ? { endDate: sql`FROM_UNIXTIME(${periodEnd})` } : {}),
        })
        .where(eq(subscriptions.id, local.id));

      // Only tell the user when the renew/don't-renew choice itself changed.
      if ("cancel_at_period_end" in previous) {
        const described = await describeVariant(local.variantId);
        await createPaymentNotice(
          io,
          local.userId,
          cancelFlag ? "subscription_cancel_scheduled" : "subscription_resumed",
          {
            plan: described.plan,
            until: formatDate(periodEnd ? periodEnd * 1000 : local.endDate),
          },
        );
      }
      return { success: true };
    }

    case "customer.subscription.deleted": {
      /** @type {any} */
      const subscription = event.data.object;
      const local = await findLocalSubscription(subscription.id);
      if (!local) return { success: true, handled: false };
      // Already ended locally (plan switch, or final failed payment) -- the user
      // was told then.
      if (local.status === SUB_STATUS.canceled) return { success: true };

      await db
        .update(subscriptions)
        .set({ status: SUB_STATUS.canceled })
        .where(eq(subscriptions.id, local.id));
      const described = await describeVariant(local.variantId);
      await createPaymentNotice(io, local.userId, "subscription_ended", {
        plan: described.plan,
      });
      return { success: true };
    }

    case "charge.refunded": {
      /** @type {any} */
      const charge = event.data.object;
      const paymentIntentId = idOf(charge.payment_intent);
      if (!paymentIntentId || !charge.refunded) return { success: true };
      const [payment] = await db
        .select({
          paymentId: payments.paymentId,
          userId: payments.userIdRef,
          variantId: payments.variantRef,
        })
        .from(payments)
        .where(eq(payments.pTransactionReference, paymentIntentId))
        .limit(1);
      if (!payment) return { success: true, handled: false };
      const moved = await transitionPayment(
        payment.paymentId,
        [PAYMENT_STATUS.completed],
        PAYMENT_STATUS.refunded,
      );
      if (moved) {
        const described = await describeVariant(payment.variantId);
        await createPaymentNotice(
          io,
          payment.userId,
          "payment_refunded",
          {
            item: described.item,
            amount: formatMoney(
              (charge.amount_refunded ?? 0) / 100,
              charge.currency,
            ),
          },
          payment.paymentId,
        );
      }
      return { success: true };
    }

    case "charge.dispute.created": {
      /** @type {any} */
      const dispute = event.data.object;
      tools.serverLog(
        `Dispute opened on charge ${idOf(dispute.charge)} (${dispute.reason})`,
        "hook_154",
      );
      await logPaymentIncident("payment_dispute", "", {
        disputeId: dispute.id,
        chargeId: idOf(dispute.charge),
        paymentIntentId: idOf(dispute.payment_intent),
        reason: dispute.reason,
        amount: dispute.amount,
      });
      return { success: true };
    }

    default:
      return { success: true, handled: false };
  }
}

/**
 * Grants whatever a purchased one-time product variant represents:
 * - `superlike`-category variants (rose packs), described as `{"roses": <quantity>}`
 * - `directmessage`-category packs, described as `{"directMessages": <quantity>}`
 * - `rewind`-category: "buy once, rewind once" — no balance is kept; the purchase
 *   directly performs the rewind on the match named by `matchId` (see pay.js's onetime
 *   handler, which requires matchId for this category and threads it through Stripe
 *   metadata to get here).
 * @param {string} variantId
 * @param {string} userId
 * @param {string} paymentId
 * @param {string} [matchId]
 * @returns {Promise<{ granted: boolean; rewindFailed?: boolean }>}
 */
export async function fulfillOnetimePurchase(
  variantId,
  userId,
  paymentId,
  matchId,
) {
  const variantRows = await db
    .select({
      description: productListVariant.description,
      category: productLists.category,
    })
    .from(productListVariant)
    .innerJoin(
      productLists,
      eq(productLists.plSku, productListVariant.productListsIdRef),
    )
    .where(eq(productListVariant.idAi, Number(variantId)))
    .limit(1);
  const variant = variantRows?.[0];
  if (!variant) throw new Error(`Unknown variant ${variantId}`);

  const description =
    typeof variant.description === "string"
      ? JSON.parse(variant.description)
      : variant.description;

  if (variant.category === "superlike") {
    const roses = Number(description?.roses ?? 0);
    if (!Number.isFinite(roses) || roses <= 0) return { granted: false };

    await grantRoses(userId, roses);
    tools.serverLog(
      `Granted ${roses} roses to user ${userId} for payment ${paymentId}`,
      "hook_9001",
    );
    return { granted: true };
  }

  if (variant.category === "directmessage") {
    const directMessages = Number(description?.directMessages ?? 0);
    if (!Number.isFinite(directMessages) || directMessages <= 0)
      return { granted: false };

    await grantDirectMessages(userId, directMessages);
    tools.serverLog(
      `Granted ${directMessages} direct messages to user ${userId} for payment ${paymentId}`,
      "hook_9007",
    );
    return { granted: true };
  }

  if (variant.category === "boost") {
    const boosts = Number(description?.boosts ?? 0);
    if (!Number.isFinite(boosts) || boosts <= 0) return { granted: false };

    await grantBoosts(userId, boosts);
    tools.serverLog(
      `Granted ${boosts} boosts to user ${userId} for payment ${paymentId}`,
      "hook_9006",
    );
    return { granted: true };
  }

  if (variant.category === "rewind") {
    if (!matchId) {
      tools.serverLog(
        `Rewind purchase completed with no matchId for payment ${paymentId}`,
        "hook_9004",
      );
      return { granted: false, rewindFailed: true };
    }

    const [result] = await db.execute(
      sql`UPDATE matches SET match_status = '0' WHERE match_id = ${matchId} AND match_user_id_to = ${userId} AND match_status = '2'`,
    );
    if (result.affectedRows === 0) {
      tools.serverLog(
        `Rewind purchase completed but match ${matchId} was no longer rewindable for payment ${paymentId}`,
        "hook_9005",
      );
      return { granted: false, rewindFailed: true };
    }
    tools.serverLog(
      `Rewound match ${matchId} for user ${userId} for payment ${paymentId}`,
      "hook_9003",
    );
    return { granted: true };
  }
  return { granted: false };
}

/**
 * @param {string} paymentId
 * @param {keyof typeof PAYMENT_STATUS} statusKey
 * @param {string} [transactionReference]
 */
export async function updatePaymentStatus(
  paymentId,
  statusKey,
  transactionReference,
) {
  await db
    .update(payments)
    .set({
      status: PAYMENT_STATUS[statusKey] ?? PAYMENT_STATUS.pending,
      ...(transactionReference
        ? { pTransactionReference: transactionReference }
        : {}),
    })
    .where(eq(payments.paymentId, paymentId));
}

export default webhook_router;
