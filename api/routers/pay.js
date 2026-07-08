import express from "express";
import { drizzle } from "drizzle-orm/mysql2";
import { and, eq, sql } from "drizzle-orm";
import { tools, stripe_gateway } from "../global/functions.js";
import { sessions } from "../global/sessions.js";
import GatewayPay from "./payments/gateway.js";
import { db, pool } from "../db/client.js";
import * as schema from "../db/schema.js";
import {
  iapTransactions,
  payments,
  productListVariant,
  productLists,
  subscriptions,
  users,
} from "../db/schema.js";
import { fulfillOnetimePurchase } from "./payments/router_hook.js";
import {
  verifyAppleTransaction,
  verifyGooglePurchase,
} from "../global/iapVerify.js";

import fs from "fs";
const variables = JSON.parse(
  fs.readFileSync("./global/variables.json", "utf8"),
);

const pay_router = express.Router();

// subscriptions.external_platform: 1=stripe,2=apple,3=google
const IAP_PLATFORM_CODE = { apple: 2, google: 3 };

// Fallback when the store doesn't hand back an expiry (e.g. pseudo-mode Google one-time
// lookups don't have one); mirrors gateway.js's billing_cycle semantics in days instead of
// Stripe's {interval,interval_count} shape.
/**
 * @param {string | number} cycle
 */
function daysForBillingCycle(cycle) {
  // @ts-ignore
  return { 2: 7, 3: 14, 4: 30, 5: 365 }[cycle] ?? null;
}

/** Looks up an active product+variant, joined with the caller's user row
 * (for user_email), matching the shape both subscribe/onetime need. */
async function findActiveProduct(userId, sku, variantId) {
  const rows = await db
    .select({
      pl_sku: productLists.plSku,
      pl_name: productLists.plName,
      pl_description: productLists.plDescription,
      category: productLists.category,
      variant_id: productListVariant.idAi,
      variant_description: productListVariant.description,
      price: productListVariant.price,
      billing_cycle: productListVariant.billingCycle,
      external_3rdparty_store_product_id:
        productListVariant.external_3rdpartyStoreProductId,
      user_email: users.userEmail,
    })
    .from(productLists)
    .innerJoin(
      productListVariant,
      eq(productListVariant.productListsIdRef, productLists.plSku),
    )
    .innerJoin(users, eq(users.userId, userId))
    .where(
      and(
        eq(productLists.plIsActive, "1"),
        eq(productListVariant.active, "1"),
        eq(productLists.plSku, sku),
        eq(productListVariant.idAi, Number(variantId)),
      ),
    )
    .limit(1);
  return rows?.[0];
}

pay_router.post("/:division", async (req, res) => {
  const { division } = req.params;

  const headers = req.headers;
  // if division !== "webhook" doesnt require auth

  const auth_token = Array.isArray(headers["x-omi-auth"])
    ? headers["x-omi-auth"][0]
    : (headers["x-omi-auth"] ?? "");

  const sessionValidation = sessions.verifyFullSession(auth_token);
  if (!sessionValidation.status) {
    return res.status(sessionValidation.code).json({
      code: sessionValidation.code,
      message: sessionValidation.message,
    });
  }

  try {
    switch (division) {
      case "subscribe": {
        const { s_duration_int, s_sku } = req.body;

        // Validate required parameters
        if (!s_duration_int || !s_sku) {
          return res.status(400).json({
            code: 400,
            message:
              "Missing required parameters: s_duration_int and s_sku are required.",
          });
        }

        // Fetch product details with retry logic
        let product;
        try {
          product = await findActiveProduct(
            sessions?.currentUserID,
            s_sku,
            s_duration_int,
          );
        } catch {
          return res.status(500).json({
            code: 500,
            message: "Database error occurred. Please try again later.",
          });
        }

        if (!product) {
          return res
            .status(404)
            .json({ code: 404, message: "Product not found or inactive." });
        }

        const v_price = product.price;

        // Validate price
        if (!v_price || v_price <= 0) {
          return res
            .status(400)
            .json({ code: 400, message: "Invalid product price." });
        }

        // Generate payment ID
        const gen_payment_id = `pay${tools.generateAlphanumeric(10, tools.randomInt(15, 46))}`;

        // Insert payment record with transaction. A single manually-managed
        // connection (not db.transaction()) because commit/rollback here is
        // decided by the outcome of an external Stripe call, not just DB
        // errors -- Drizzle's transaction() only commits-on-return/
        // rollback-on-throw, which can't express "roll back, but still
        // return the Stripe response to the caller" in one shot.
        const connection = await pool.getConnection();
        const txDb = drizzle(connection, { schema, mode: "default" });
        try {
          await connection.beginTransaction();

          await txDb.insert(payments).values({
            userIdRef: sessions?.currentUserID,
            paymentId: gen_payment_id,
            type: 1,
            pAmount: String(v_price),
            pCurrency: "USD",
            variantRef: Number(s_duration_int),
            status: 0,
          });

          // Create Stripe session
          const sub = await GatewayPay.subscribe(
            req.get("host"),
            s_sku,
            s_duration_int,
            product.user_email,
            product.pl_name,
            product.billing_cycle,
            v_price,
            gen_payment_id,
          );

          if (sub.code === 301) {
            await connection.commit();
            return res.json(sub);
          } else {
            await connection.rollback();
            return res
              .status(sub.code)
              .json({ code: sub.code, message: sub.message });
          }
        } catch (error) {
          await connection.rollback();
          tools.serverLog(
            `Payment transaction failed for user ${sessions?.currentUserID}: ${error}`,
          );
          return res.status(500).json({
            code: 500,
            message: "Payment initialization failed. Please try again.",
          });
        } finally {
          connection.release();
        }
      }

      case "onetime": {
        const { ot_duration, sku, matchId: onetimeMatchId } = req.body;

        // Validate required parameters
        if (!ot_duration || !sku) {
          return res.status(400).json({
            code: 400,
            message:
              "Missing required parameters: ot_duration and sku are required.",
          });
        }

        // Fetch product details
        let onetimeProduct;
        try {
          onetimeProduct = await findActiveProduct(
            sessions?.currentUserID,
            sku,
            ot_duration,
          );
        } catch {
          return res.status(500).json({
            code: 500,
            message: "Database error occurred. Please try again later.",
          });
        }

        if (!onetimeProduct) {
          return res
            .status(404)
            .json({ code: 404, message: "Product not found or inactive." });
        }

        const onetimePrice = onetimeProduct.price;

        if (!onetimePrice || onetimePrice <= 0) {
          return res
            .status(400)
            .json({ code: 400, message: "Invalid product price." });
        }

        // Rewind is "buy once, rewind once" — the purchase must say which match it applies
        // to so the webhook can perform the rewind directly on payment completion.
        if (onetimeProduct.category === "rewind" && !onetimeMatchId) {
          return res.status(400).json({
            code: 400,
            message: "Missing matchId for rewind purchase.",
          });
        }

        // Generate payment ID
        const onetimePaymentId = `pay${tools.generateAlphanumeric(10, tools.randomInt(15, 46))}`;

        // Insert payment record -- same manual-connection reasoning as
        // "subscribe" above.
        const onetimeConnection = await pool.getConnection();
        const onetimeTxDb = drizzle(onetimeConnection, {
          schema,
          mode: "default",
        });
        try {
          await onetimeConnection.beginTransaction();

          await onetimeTxDb.insert(payments).values({
            userIdRef: sessions?.currentUserID,
            paymentId: onetimePaymentId,
            type: 2,
            pAmount: String(onetimePrice),
            pCurrency: "USD",
            variantRef: Number(ot_duration),
            status: 0,
          });

          // Create one-time payment session
          const onetimeResult = await GatewayPay.onetime(
            req.get("host"),
            sku,
            ot_duration,
            onetimeProduct.user_email,
            onetimeProduct.pl_name,
            onetimeProduct.billing_cycle,
            onetimePrice,
            onetimePaymentId,
            onetimeMatchId,
          );

          if (onetimeResult.code === 301) {
            await onetimeConnection.commit();
            return res.json(onetimeResult);
          } else {
            await onetimeConnection.rollback();
            return res.status(onetimeResult.code).json({
              code: onetimeResult.code,
              message: onetimeResult.message,
            });
          }
        } catch (error) {
          await onetimeConnection.rollback();
          tools.serverLog(
            `One-time payment transaction failed for user ${sessions?.currentUserID}: ${error}`,
          );
          return res.status(500).json({
            code: 500,
            message:
              "One-time payment initialization failed. Please try again.",
          });
        } finally {
          onetimeConnection.release();
        }
      }

      case "cancel-subscription": {
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
          return res.status(400).json({
            code: 400,
            message: "Missing required parameter: subscriptionId.",
          });
        }

        let subscriptionRow;
        try {
          const subRows = await db
            .select({
              id: subscriptions.id,
              user_id: subscriptions.userId,
              external_id: subscriptions.externalId,
              status: subscriptions.status,
              cancel_at_period_end: subscriptions.cancelAtPeriodEnd,
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId))
            .limit(1);
          subscriptionRow = subRows?.[0];
        } catch {
          return res.status(500).json({
            code: 500,
            message: "Database error occurred. Please try again later.",
          });
        }

        if (
          !subscriptionRow ||
          subscriptionRow.user_id !== sessions?.currentUserID
        ) {
          return res
            .status(404)
            .json({ code: 404, message: "Subscription not found." });
        }

        if (subscriptionRow.status !== 1) {
          return res.status(400).json({
            code: 400,
            message: "Only active subscriptions can be cancelled.",
          });
        }

        if (subscriptionRow.cancel_at_period_end) {
          return res.status(400).json({
            code: 400,
            message: "This subscription is already scheduled to cancel.",
          });
        }

        try {
          await stripe_gateway.subscriptions.update(
            subscriptionRow.external_id,
            { cancel_at_period_end: true },
          );
        } catch (stripeError) {
          tools.serverLog(
            `Stripe cancel-subscription failed for ${subscriptionId}: ${stripeError}`,
            "pay-cancel-0",
          );
          return res.status(502).json({
            code: 502,
            message: "Unable to reach the payment provider. Please try again.",
          });
        }

        try {
          await db
            .update(subscriptions)
            .set({ cancelAtPeriodEnd: 1, canceledAt: sql`NOW()` })
            .where(eq(subscriptions.id, subscriptionId));
        } catch (dbError) {
          tools.serverLog(
            `Local cancel-subscription update failed for ${subscriptionId}: ${dbError}`,
            "pay-cancel-1",
          );
          return res.status(500).json({
            code: 500,
            message:
              "Cancellation was recorded with the payment provider, but failed to save locally. Please contact support.",
          });
        }

        return res.json({
          code: 200,
          message:
            "Subscription will be cancelled at the end of the current billing period.",
          subscriptionId,
          cancel_at_period_end: true,
        });
      }

      case "iap-verify": {
        const {
          purchaseType,
          platform,
          sku,
          variantId,
          productId,
          transactionId,
          purchaseToken,
          matchId: iapMatchId,
        } = req.body;

        if (
          !["subscribe", "onetime"].includes(purchaseType) ||
          !IAP_PLATFORM_CODE[platform] ||
          !sku ||
          !variantId ||
          !productId ||
          !transactionId ||
          !purchaseToken
        ) {
          return res.status(400).json({
            code: 400,
            message:
              "Missing or invalid required parameters for IAP verification.",
          });
        }

        let variant;
        try {
          const variantRows = await db
            .select({
              pl_sku: productLists.plSku,
              category: productLists.category,
              variant_id: productListVariant.idAi,
              price: productListVariant.price,
              billing_cycle: productListVariant.billingCycle,
              external_3rdparty_store_product_id:
                productListVariant.external_3rdpartyStoreProductId,
            })
            .from(productLists)
            .innerJoin(
              productListVariant,
              eq(productListVariant.productListsIdRef, productLists.plSku),
            )
            .where(
              and(
                eq(productLists.plIsActive, "1"),
                eq(productListVariant.active, "1"),
                eq(productLists.plSku, sku),
                eq(productListVariant.idAi, Number(variantId)),
              ),
            )
            .limit(1);
          variant = variantRows?.[0];
        } catch {
          return res.status(500).json({
            code: 500,
            message: "Database error occurred. Please try again later.",
          });
        }

        if (!variant) {
          return res
            .status(404)
            .json({ code: 404, message: "Product not found or inactive." });
        }
        if (variant.external_3rdparty_store_product_id !== productId) {
          tools.serverLog(
            `IAP productId mismatch: client sent ${productId}, expected ${variant.external_3rdparty_store_product_id}`,
            "pay-iap-0",
          );
          return res.status(400).json({
            code: 400,
            message: "Product identifier does not match this store listing.",
          });
        }
        if (variant.category === "rewind" && !iapMatchId) {
          return res.status(400).json({
            code: 400,
            message: "Missing matchId for rewind purchase.",
          });
        }

        // Idempotent: the client may resend the same transaction (e.g. app relaunch before
        // finishTransaction runs), in which case this insert fails and we short-circuit.
        try {
          await db.insert(iapTransactions).values({
            transactionId,
            platform: IAP_PLATFORM_CODE[platform],
            productId,
            variantIdRef: Number(variantId),
            userIdRef: sessions?.currentUserID,
            matchIdRef: iapMatchId ?? null,
            status: 0,
          });
        } catch {
          const existingRows = await db
            .select({
              status: iapTransactions.status,
              payment_id_ref: iapTransactions.paymentIdRef,
            })
            .from(iapTransactions)
            .where(eq(iapTransactions.transactionId, transactionId))
            .limit(1);
          const existing = existingRows?.[0];
          if (existing?.status === 1) {
            return res.json({
              code: 200,
              message: "Purchase already verified.",
              paymentId: existing.payment_id_ref,
            });
          }
          return res.status(409).json({
            code: 409,
            message: "This transaction is already being processed.",
          });
        }

        let verification;
        try {
          verification =
            platform === "apple"
              ? await verifyAppleTransaction(transactionId, purchaseToken)
              : await verifyGooglePurchase(
                  productId,
                  purchaseToken,
                  purchaseType === "subscribe",
                );
        } catch (verifyError) {
          tools.serverLog(
            `IAP verification failed for transaction ${transactionId}: ${verifyError}`,
            "pay-iap-1",
          );
          await db
            .update(iapTransactions)
            .set({ status: 2 })
            .where(eq(iapTransactions.transactionId, transactionId));
          return res.status(502).json({
            code: 502,
            message:
              "Unable to verify this purchase with the store. Please try again.",
          });
        }

        if (verification.productId !== productId) {
          tools.serverLog(
            `IAP verified productId ${verification.productId} does not match requested ${productId}`,
            "pay-iap-2",
          );
          await db
            .update(iapTransactions)
            .set({ status: 2 })
            .where(eq(iapTransactions.transactionId, transactionId));
          return res.status(400).json({
            code: 400,
            message: "Store verification returned a different product.",
          });
        }

        const isExpired =
          purchaseType === "subscribe" &&
          verification.expiresAtMs &&
          verification.expiresAtMs < Date.now();
        const isInactive =
          purchaseType === "subscribe" && verification.isActive === false;
        if (isExpired || isInactive) {
          tools.serverLog(
            `IAP subscription not active for transaction ${transactionId}`,
            "pay-iap-5",
          );
          await db
            .update(iapTransactions)
            .set({ status: 2 })
            .where(eq(iapTransactions.transactionId, transactionId));
          return res.status(400).json({
            code: 400,
            message: "This subscription is not currently active.",
          });
        }

        const genPaymentId = `pay${tools.generateAlphanumeric(10, tools.randomInt(15, 46))}`;
        try {
          await db.transaction(async (tx) => {
            await tx.insert(payments).values({
              userIdRef: sessions?.currentUserID,
              paymentId: genPaymentId,
              type: purchaseType === "subscribe" ? 1 : 2,
              pAmount: String(variant.price),
              pCurrency: "USD",
              variantRef: Number(variantId),
              status: 1,
              pTransactionReference: transactionId,
            });

            if (purchaseType === "subscribe") {
              const genSubId = tools.generateAlphanumeric(
                10,
                tools.randomInt(20, 50),
              );
              const expiresAtMs =
                verification.expiresAtMs ??
                (() => {
                  const days = daysForBillingCycle(variant.billing_cycle);
                  return days ? Date.now() + days * 24 * 60 * 60 * 1000 : null;
                })();
              if (!expiresAtMs) {
                throw new Error("Unable to determine subscription expiry");
              }

              await tx.insert(subscriptions).values({
                id: genSubId,
                userId: sessions?.currentUserID,
                variantIdRef: Number(variantId),
                startDate: sql`NOW()`,
                endDate: sql`FROM_UNIXTIME(${Math.floor(expiresAtMs / 1000)})`,
                externalPlatform: IAP_PLATFORM_CODE[platform],
                externalId: verification.originalTransactionId ?? transactionId,
                paymentIdRef: genPaymentId,
                status: 1,
              });
            }

            await tx
              .update(iapTransactions)
              .set({
                status: 1,
                paymentIdRef: genPaymentId,
                verificationMode: verification.mode === "verified" ? 1 : 0,
                // verification_response is a native JSON column -- pass the
                // object, not a pre-stringified string.
                verificationResponse: verification.raw ?? {},
              })
              .where(eq(iapTransactions.transactionId, transactionId));
          });
        } catch (error) {
          tools.serverLog(
            `IAP fulfillment transaction failed for ${transactionId}: ${error}`,
            "pay-iap-3",
          );
          return res.status(500).json({
            code: 500,
            message: "Failed to record this purchase. Please contact support.",
          });
        }

        if (purchaseType === "onetime") {
          try {
            await fulfillOnetimePurchase(
              variantId,
              sessions?.currentUserID,
              genPaymentId,
              iapMatchId,
            );
          } catch (fulfillError) {
            tools.serverLog(
              `Error fulfilling IAP one-time purchase for payment ${genPaymentId}: ${fulfillError}`,
              "pay-iap-4",
            );
          }
        }

        return res.json({
          code: 200,
          message: "Purchase verified.",
          paymentId: genPaymentId,
          verified: verification.mode === "verified",
        });
      }

      default:
        return res.status(400).json({
          code: 400,
          message: "Invalid payment type. Supported: subscribe, onetime",
        });
    }
  } catch (error) {
    tools.serverLog(
      `Unexpected error in payment processing for user ${sessions?.currentUserID}: ${error}`,
    );
    return res.status(500).json({
      code: 500,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
});

pay_router.get("/success", async (req, res) => {
  return res.redirect(variables.site.hotlink_payment_200);
});

pay_router.get("/cancel", async (req, res) => {
  return res.redirect(variables.site.hotlink_payment_400);
});

export default pay_router;
