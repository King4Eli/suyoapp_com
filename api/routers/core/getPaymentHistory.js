import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { payments, productListVariant, productLists } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

export default async function getPaymentHistory() {
  /** @type { any } */
  const response = { code: 404, message: "No payment history found." };

  try {
    const rows = await db
      .select({
        payment_id: payments.paymentId,
        p_amount: payments.pAmount,
        p_currency: payments.pCurrency,
        type: payments.type,
        status: payments.status,
        p_created_at: payments.pCreatedAt,
        product_name: productLists.plName,
        plan_name: productListVariant.name,
      })
      .from(payments)
      .leftJoin(
        productListVariant,
        eq(payments.variantRef, productListVariant.idAi),
      )
      .leftJoin(
        productLists,
        eq(productListVariant.productListsIdRef, productLists.plSku),
      )
      .where(eq(payments.userIdRef, sessions.currentUserID))
      .orderBy(desc(payments.pCreatedAt))
      .limit(100);

    const history = rows.map((row) => ({
      paymentId: row.payment_id,
      amount: parseFloat(row.p_amount),
      currency: row.p_currency,
      type: Number(row.type) === 1 ? "subscription" : "onetime",
      status: Number(row.status),
      productName: row.product_name,
      planName: row.plan_name,
      createdAt: row.p_created_at,
    }));
    response.code = 200;
    response.message = "ok";
    response.history = history;
  } catch (err) {
    tools.serverLog(
      `Error in getPaymentHistory: ${err}`,
      "getPaymentHistory-0",
    );
    response.code = 500;
    response.message = "Database error.";
  }
  return response;
}
