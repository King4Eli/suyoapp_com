import express from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { redisDo } from "../global/redisClient.js";
import { presignPut } from "../global/s3bender.js";
import os from "os";

const status_check = express.Router();

// Bounds how long any single dependency check can hold up the response --
// without this, a network black hole to Redis or s3bender (no port refusal,
// just silence) would hang this endpoint indefinitely instead of reporting
// "down" quickly, which is the one thing a health check must never do.
const CHECK_TIMEOUT_MS = 3000;

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {string} label
 * @returns {Promise<T>}
 */
function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`${label} check timed out after ${CHECK_TIMEOUT_MS}ms`),
          ),
        CHECK_TIMEOUT_MS,
      ),
    ),
  ]);
}

const getSystemInfo = () => ({
  memory: {
    usage: process.memoryUsage().heapUsed / 1024 / 1024,
    limit: process.memoryUsage().heapTotal / 1024 / 1024,
  },
  loadavg: process.env.NODE_ENV !== "production" ? os.loadavg() : undefined,
});

/** @param {PromiseSettledResult<any>} result */
function checkResult(result) {
  if (result.status === "rejected") {
    return {
      status: "error",
      message:
        process.env.NODE_ENV === "production"
          ? "Unavailable"
          : (result.reason?.message ?? String(result.reason)),
    };
  }
  return { status: "ok", message: "Connected" };
}

status_check.get("/", async (req, res) => {
  const startedAt = Date.now();

  // Run every dependency check in parallel -- Promise.allSettled so a
  // rejection from one (e.g. Redis down) doesn't stop the others from
  // reporting. Each is individually time-boxed by withTimeout.
  const [dbResult, redisResult, storageResult] = await Promise.allSettled([
    withTimeout(db.execute(sql`SELECT 1`), "database"),
    // PING is the standard Redis liveness command -- round-trips through the
    // real connection (lazily connecting it on first use) rather than just
    // checking a cached "connected" flag.
    withTimeout(
      redisDo((client) => client.ping()),
      "redis",
    ),
    // Presigning doesn't touch storage (no object is written until something
    // PUTs to the URL), so this verifies network reachability + auth against
    // s3bender without side effects. Short-lived key/expiry since the URL is
    // only ever used to prove the round-trip worked.
    withTimeout(
      presignPut(`_health/${os.hostname()}-${Date.now()}`, 10),
      "storage",
    ),
  ]);

  const database = checkResult(dbResult);
  const redis = checkResult(redisResult);
  const storage = checkResult(storageResult);

  if (dbResult.status === "rejected")
    console.error("Database health check failed:", dbResult.reason);
  if (redisResult.status === "rejected")
    console.error("Redis health check failed:", redisResult.reason);
  if (storageResult.status === "rejected")
    console.error(
      "Storage (s3bender) health check failed:",
      storageResult.reason,
    );

  const checks = {
    api: { status: "ok", responseTimeMs: Date.now() - startedAt },
    // Hard dependencies: nothing meaningful works without the database, and
    // login/signup verification codes live only in Redis (no DB fallback --
    // see routers/auth/login.js and signup.js), so both being down means the
    // API can't serve its core purpose.
    database,
    redis,
    // Soft dependency: media upload/download degrades without s3bender, but
    // auth, matching, and text chat keep working.
    storage,
  };

  const isDown = database.status !== "ok" || redis.status !== "ok";
  const isDegraded = !isDown && storage.status !== "ok";
  const status = isDown ? "down" : isDegraded ? "degraded" : "ok";

  const response = {
    version: os.hostname(),
    status,
    checks,
    system: getSystemInfo(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  return res.status(isDown ? 503 : 200).json(response);
});

export default status_check;
