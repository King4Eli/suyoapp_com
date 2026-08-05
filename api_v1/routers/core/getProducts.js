import { createHash } from "crypto";
import db_pool from "../../global/database.js";
import { tools, namer, envInt } from "../../global/functions.js";
import { redisDo } from "../../global/redisClient.js";

const PRODUCTS_CACHE_TTL_SECONDS = envInt('PRODUCTS_CACHE_TTL_SECONDS', 10 * 60); // 10 minutes

// @ts-ignore
export default async function getProducts() {
  /** @type { any } */
  const response = { code: 404, message: "This empty products." };
  try {
    const cached = await redisDo(async (client) => client.get(namer.redis.products)).catch((err) => {
      tools.serverLog(`Redis read failed in getProducts: ${err}`, "getProducts-1");
      return null;
    });

    if (cached) {
      response.products = JSON.parse(cached);
      response.code = 200;
      response.message = "ok";
      return response;
    }

    // list products
    const [productRows] = await db_pool.query(`SELECT
                JSON_OBJECT(
                    'category', pl.category,
                    'products', JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'sku', pl.pl_sku,
                            'name', pl.pl_name,
                            'description', JSON_EXTRACT(pl.pl_description, '$'),
                            'variants', (
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'id', pv.id_ai,
                                        'name', pv.name,
                                        'price', pv.price,
                                        'billing_cycle', pv.billing_cycle,
                                        'metadata', JSON_EXTRACT(pv.description, '$'),
                                        'store_product_id', pv.external_3rdparty_store_product_id
                                    )
                                )
                                FROM product_list_variant pv
                                WHERE pv.product_lists_id_ref = pl.pl_sku
                                AND pv.active = '1'
                            )
                        )
                    )
                ) AS category_data
            FROM product_lists pl
            WHERE pl.pl_is_active = '1'
            GROUP BY pl.category; `);
            
    response.products = productRows;
    response.code = 200;
    response.message = "ok";

    await redisDo(async (client) => {
      await client.set(namer.redis.products, JSON.stringify(productRows), { EX: PRODUCTS_CACHE_TTL_SECONDS });
    }).catch((err) => {
      tools.serverLog(`Redis write failed in getProducts: ${err}`, "getProducts-2");
    });
  }
  catch (err) {
    tools.serverLog(`Error in getProducts: ${err}`,"getProducts-0");
    response.code = 500;
    response.message = "Unexpected error.";
  }
  return response;
}
