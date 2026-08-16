import { createClient } from "redis";
import { tools } from "./functions.js";

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

redisClient.on("error", (err) => {
  tools.serverLog("Redis Client Error: " + err.message, "redis_error_tgl1");
});

/** @type any */
let connectPromise = null;
async function ensureRedisConnected() {
  if (!connectPromise) {
    connectPromise = redisClient.connect();
  }
  await connectPromise;
  return redisClient;
}

/**
 * @template T
 * @param {(client: typeof redisClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export async function redisDo(callback) {
  const e = await ensureRedisConnected();
  return await callback(e);
}
