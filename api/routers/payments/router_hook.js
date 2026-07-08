import express from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  payments,
  productListVariant,
  productLists,
  stripeEvents,
  subscriptions,
  userRoseUsage,
} from "../../db/schema.js";
import { stripe_gateway, tools } from "../../global/functions.js";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_SIGNING_SECRET ?? "";

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
    // @ts-ignore
    tools.serverLog(
      `Webhook signature verification failed: ${err.message}`,
      "hook_137",
    );
    return res
      .status(400)
      .json({ code: 400, message: "Webhook signature verification failed" });
  }

  try {
    const result = await processWebhookEvent(event);

    if (result.success) {
      if (result.handled === false) {
        return res.status(200).json({
          code: 200,
          message: "Webhook received but not handled",
          eventType: event.type,
        });
      }
      if (result.duplicate) {
        return res.status(200).json({
          code: 200,
          message: "Webhook already processed",
          eventType: event.type,
        });
      }
      return res.status(200).json({
        code: 200,
        message: "Webhook processed successfully",
        eventType: event.type,
      });
    } else {
      tools.serverLog(`Webhook processing failed: ${result.error}`, "hook_138");
      return res
        .status(500)
        .json({ code: 500, message: "Webhook processing failed" });
    }
  } catch (error) {
    tools.serverLog(
      `Unexpected error processing webhook: ${error}`,
      "hook_139",
    );
    return res
      .status(500)
      .json({ code: 500, message: "Internal server error" });
  }
});

/**
 * @param {import("stripe").Stripe.Event} event
 */
async function processWebhookEvent(event) {
  const maxRetries = 3;

  // Deduplicate: skip events already processed
  try {
    await db
      .insert(stripeEvents)
      .values({ eventId: event.id, eventType: event.type });
  } catch {
    // Duplicate key means this event was already handled
    tools.serverLog(
      `Duplicate webhook event skipped: ${event.id}`,
      "hook_4857",
    );
    return { success: true, duplicate: true };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const metadata = session.metadata || {};

      const sku_variant = metadata.sku_variant;
      const paymentId = metadata.paymentId;
      const userId = metadata.userId;
      const matchId = metadata.matchId;
      const type = session.mode;

      if (!userId || !paymentId || !sku_variant) {
        tools.serverLog(
          "Missing required metadata in checkout.session.completed",
          "hook_140",
        );
        return { success: false, error: "Missing required metadata" };
      }

      try {
        if (type === "subscription") {
          const sessionSubscription = session.subscription;
          const subscriptionId =
            typeof sessionSubscription === "string"
              ? sessionSubscription
              : sessionSubscription?.id;

          if (!subscriptionId) {
            tools.serverLog(
              "Missing subscription ID for subscription checkout",
              "hook_141",
            );
            return { success: false, error: "Missing subscription ID" };
          }

          await updatePaymentStatus(paymentId, "completed", subscriptionId);

          let subscription_details;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              // @ts-ignore
              subscription_details =
                await stripe_gateway.subscriptions.retrieve(subscriptionId);
              break;
            } catch (stripeError) {
              tools.serverLog(
                `Stripe subscription retrieve attempt ${attempt} failed: ${stripeError}`,
                "hook_142",
              );
              if (attempt === maxRetries) {
                return {
                  success: false,
                  error: "Failed to retrieve subscription details",
                };
              }
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, attempt) * 1000),
              );
            }
          }

          // Stripe moved current_period_start/end from the Subscription object onto its
          // subscription items in recent API versions — read from there, not the top level.
          // @ts-ignore
          const startsAt =
            subscription_details?.items?.data?.[0]?.current_period_start ?? 0;
          // @ts-ignore
          const expiresAt =
            subscription_details?.items?.data?.[0]?.current_period_end ?? 0;
          const genId = tools.generateAlphanumeric(10, tools.randomInt(20, 50));

          try {
            await db.transaction(async (tx) => {
              await tx.insert(subscriptions).values({
                id: genId,
                userId,
                variantIdRef: Number(sku_variant),
                startDate: sql`FROM_UNIXTIME(${startsAt})`,
                endDate: sql`FROM_UNIXTIME(${expiresAt})`,
                externalPlatform: 1,
                externalId: subscriptionId,
                paymentIdRef: paymentId,
                status: 1,
              });
            });
            tools.serverLog(
              `Subscription created successfully: ${genId}`,
              "hook_897",
            );
            return { success: true };
          } catch (dbError) {
            tools.serverLog(
              `Database transaction failed for subscription: ${dbError}`,
              "hook_489",
            );
            return {
              success: false,
              error: "Database error creating subscription",
            };
          }
        } else if (type === "payment") {
          await updatePaymentStatus(paymentId, "completed", session.id);
          tools.serverLog(
            `One-time payment completed: ${paymentId}`,
            "hook_8997",
          );

          // Fulfillment is best-effort and isolated from the outer catch: the webhook
          // event is already deduped by event_id at this point, so letting an error
          // escape here would mark the payment completed but never retry the grant.
          try {
            await fulfillOnetimePurchase(
              sku_variant,
              userId,
              paymentId,
              matchId,
            );
          } catch (fulfillError) {
            tools.serverLog(
              `Error fulfilling one-time purchase for payment ${paymentId}: ${fulfillError}`,
              "hook_9002",
            );
          }

          return { success: true };
        }
      } catch (error) {
        tools.serverLog(
          `Error processing checkout.session.completed: ${error}`,
          "hook_0857",
        );
        return { success: false, error: "Processing error" };
      }

      return { success: true };
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      // @ts-ignore
      const invoiceSubscription = invoice.subscription;
      const subscriptionId =
        typeof invoiceSubscription === "string"
          ? invoiceSubscription
          : invoiceSubscription?.id;

      if (!subscriptionId) {
        tools.serverLog(
          "Missing subscription ID in invoice.payment_succeeded",
          "hook_121",
        );
        return { success: false, error: "Missing subscription ID" };
      }

      try {
        await db.transaction(async (tx) => {
          let subscription_details;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              subscription_details =
                await stripe_gateway.subscriptions.retrieve(subscriptionId);
              break;
            } catch (stripeError) {
              tools.serverLog(
                `Stripe subscription retrieve attempt ${attempt} failed: ${stripeError}`,
                "hook_122",
              );
              if (attempt === maxRetries) {
                throw new Error("Failed to retrieve subscription details", {
                  cause: stripeError,
                });
              }
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, attempt) * 1000),
              );
            }
          }

          // @ts-ignore
          const newEndDate =
            subscription_details?.items?.data?.[0]?.current_period_end ?? 0;

          // Look up our subscription record to get user_id and variant for the renewal payment
          const subRows = await tx
            .select({
              user_id: subscriptions.userId,
              variant_id_ref: subscriptions.variantIdRef,
            })
            .from(subscriptions)
            .where(eq(subscriptions.externalId, subscriptionId))
            .limit(1);

          await tx
            .update(subscriptions)
            .set({ endDate: sql`FROM_UNIXTIME(${newEndDate})`, status: 1 })
            .where(eq(subscriptions.externalId, subscriptionId));

          // Create a payment record for the renewal so every charge is tracked
          if (Array.isArray(subRows) && subRows.length > 0) {
            const sub = subRows[0];
            const renewalPaymentId = `pay${tools.generateAlphanumeric(10, tools.randomInt(20, 50))}`;
            const amountPaid = (invoice.amount_paid ?? 0) / 100;
            const currency = (invoice.currency ?? "usd").toUpperCase();

            await tx.insert(payments).values({
              paymentId: renewalPaymentId,
              type: 1,
              userIdRef: sub.user_id,
              pAmount: String(amountPaid),
              pCurrency: currency,
              variantRef: sub.variant_id_ref,
              status: 1,
              pTransactionReference: invoice.id ?? "",
            });
          }
        });

        tools.serverLog(
          `Subscription renewed successfully: ${subscriptionId}`,
          "hook_123",
        );
        return { success: true };
      } catch (dbError) {
        tools.serverLog(
          `Database transaction failed for invoice payment succeeded: ${dbError}`,
          "hook_124",
        );
        return {
          success: false,
          error: "Database error updating subscription",
        };
      }
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      // @ts-ignore
      const invoiceSubscription = invoice.subscription;
      const subscriptionId =
        typeof invoiceSubscription === "string"
          ? invoiceSubscription
          : invoiceSubscription?.id;

      if (!subscriptionId) {
        tools.serverLog(
          "Missing subscription ID in invoice.payment_failed",
          "hook_126",
        );
        return { success: false, error: "Missing subscription ID" };
      }

      try {
        await db.transaction(async (tx) => {
          const attemptCount = invoice.attempt_count || 0;
          const nextPaymentAttempt = invoice.next_payment_attempt;

          // 3=cancelled, 2=past_due
          const newStatus = !nextPaymentAttempt || attemptCount >= 3 ? 3 : 2;

          await tx
            .update(subscriptions)
            .set({ status: newStatus })
            .where(eq(subscriptions.externalId, subscriptionId));

          const genReportId = tools.generateAlphanumeric(11, 30);
          const reportData = JSON.stringify({
            subscriptionId,
            attempt: attemptCount,
            event: "payment_failed",
          });

          await tx.execute(
            sql`INSERT INTO logs_application (report_id, report_type, report_data, report_status, report_currentuser)
                SELECT ${genReportId}, 'payment_failed', ${reportData}, 0, s.user_id
                FROM subscriptions s WHERE s.external_id = ${subscriptionId}
                LIMIT 1`,
          );
        });

        tools.serverLog(
          `Subscription payment failed: ${subscriptionId}, status updated`,
          "hook_127",
        );
        return { success: true };
      } catch (dbError) {
        tools.serverLog(
          `Database transaction failed for invoice payment failed: ${dbError}`,
          "hook_128",
        );
        return {
          success: false,
          error: "Database error updating subscription status",
        };
      }
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const subscriptionId = subscription.id;
      const newCancelFlag = subscription.cancel_at_period_end ? 1 : 0;
      // Stripe statuses we track locally: trialing=4, active=1, past_due=2, canceled=3.
      // Others (unpaid/incomplete/paused) are left untouched rather than guessed at.
      /** @type any */
      const STRIPE_TO_LOCAL_STATUS = {
        trialing: 4,
        active: 1,
        past_due: 2,
        canceled: 3,
      };
      const mappedStatus = STRIPE_TO_LOCAL_STATUS[subscription.status] ?? null;

      try {
        const existingRows = await db
          .select({ cancel_at_period_end: subscriptions.cancelAtPeriodEnd })
          .from(subscriptions)
          .where(eq(subscriptions.externalId, subscriptionId))
          .limit(1);
        const wasAlreadyFlagged = Boolean(
          existingRows?.[0]?.cancel_at_period_end,
        );
        const justTransitioned = newCancelFlag === 1 && !wasAlreadyFlagged;

        await db
          .update(subscriptions)
          .set({
            cancelAtPeriodEnd: newCancelFlag,
            canceledAt: justTransitioned ? sql`NOW()` : sql`canceled_at`,
            ...(mappedStatus ? { status: mappedStatus } : {}),
          })
          .where(eq(subscriptions.externalId, subscriptionId));

        tools.serverLog(
          `Subscription updated: ${subscriptionId}, cancel_at_period_end=${Boolean(newCancelFlag)}`,
          "hook_130",
        );
        return { success: true };
      } catch (error) {
        tools.serverLog(
          `Error processing customer.subscription.updated: ${error}`,
          "hook_131",
        );
        return {
          success: false,
          error: "Database error updating subscription",
        };
      }
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const subscriptionId = subscription.id;

      try {
        await db
          .update(subscriptions)
          .set({ status: 3 })
          .where(eq(subscriptions.externalId, subscriptionId));

        tools.serverLog(
          `Subscription cancelled: ${subscriptionId}`,
          "hook_132",
        );
        return { success: true };
      } catch (error) {
        tools.serverLog(
          `Error processing customer.subscription.deleted: ${error}`,
          "hook_133",
        );
        return {
          success: false,
          error: "Database error cancelling subscription",
        };
      }
    }

    default:
      tools.serverLog(`Unhandled webhook event: ${event.type}`, "hook_134");
      return { success: true, handled: false };
  }
}

/**
 * Grants whatever a purchased one-time product variant represents:
 * - `superlike`-category variants (rose packs), described as `{"roses": <quantity>}`
 * - `rewind`-category: "buy once, rewind once" — no balance is kept; the purchase
 *   directly performs the rewind on the match named by `matchId` (see pay.js's onetime
 *   handler, which requires matchId for this category and threads it through Stripe
 *   metadata to get here).
 * @param {string} variantId
 * @param {string} userId
 * @param {string} paymentId
 * @param {string} [matchId]
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
  if (!variant) return;

  const description =
    typeof variant.description === "string"
      ? JSON.parse(variant.description)
      : variant.description;

  if (variant.category === "superlike") {
    const roses = Number(description?.roses ?? 0);
    if (!Number.isFinite(roses) || roses <= 0) return;

    // Upsert: the user may never have spent a rose before, so their row in
    // user_rose_usage might not exist yet.
    await db
      .insert(userRoseUsage)
      .values({
        userId,
        roseBalance: roses,
        dailyUsed: 0,
        dailyResetDate: sql`CURRENT_DATE`,
      })
      .onDuplicateKeyUpdate({
        set: { roseBalance: sql`${userRoseUsage.roseBalance} + ${roses}` },
      });
    tools.serverLog(
      `Granted ${roses} roses to user ${userId} for payment ${paymentId}`,
      "hook_9001",
    );
    return;
  }

  if (variant.category === "rewind") {
    if (!matchId) {
      tools.serverLog(
        `Rewind purchase completed with no matchId for payment ${paymentId}`,
        "hook_9004",
      );
      return;
    }

    const [result] = await db.execute(
      sql`UPDATE matches SET match_status = '0' WHERE match_id = ${matchId} AND match_user_id_to = ${userId} AND match_status = '2'`,
    );
    if (result.affectedRows === 0) {
      tools.serverLog(
        `Rewind purchase completed but match ${matchId} was no longer rewindable for payment ${paymentId}`,
        "hook_9005",
      );
      return;
    }
    tools.serverLog(
      `Rewound match ${matchId} for user ${userId} for payment ${paymentId}`,
      "hook_9003",
    );
  }
}

// payments.status tinyint: 0=pending, 1=completed, 2=refunded, 3=failed
const PAYMENT_STATUS = { pending: 0, completed: 1, refunded: 2, failed: 3 };

/**
 * @param {string} paymentId
 * @param {'pending'|'completed'|'refunded'|'failed'} statusKey
 * @param {string} [transactionReference]
 */
export async function updatePaymentStatus(
  paymentId,
  statusKey,
  transactionReference,
) {
  try {
    const statusCode = PAYMENT_STATUS[statusKey] ?? 0;

    await db
      .update(payments)
      .set({
        status: statusCode,
        ...(transactionReference
          ? { pTransactionReference: transactionReference }
          : {}),
      })
      .where(eq(payments.paymentId, paymentId));
  } catch (error) {
    tools.serverLog(
      `Failed to update payment status for ${paymentId}:`,
      "hook_4257",
    );
    throw error;
  }
}

export default webhook_router;
