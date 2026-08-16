import express from "express";
import db_pool from "../global/database.js";
import os from "os";

const status_check = express.Router();

const getSystemInfo = () => ({
  memory: {
    usage: process.memoryUsage().heapUsed / 1024 / 1024,
    limit: process.memoryUsage().heapTotal / 1024 / 1024,
  },
  loadavg: process.env.NODE_ENV !== "production" ? os.loadavg() : undefined,
});

status_check.get("/", async (req, res) => {
  const startedAt = Date.now();
  const checks = {
    api: { status: "ok", responseTimeMs: null },
    database: { status: "pending", message: "Checking..." },
  };

  // Parallel checks for better performance
  const results = await Promise.allSettled([db_pool.query("SELECT 1")]);

  // Process database result
  if (results[0].status === "rejected") {
    console.error("Database health check failed:", results[0].reason);
    checks.database = {
      status: "error",
      message:
        process.env.NODE_ENV === "production"
          ? "Database connection failed"
          : results[0].reason.message,
    };
  } else {
    checks.database = { status: "ok", message: "Connected" };
  }

  // @ts-ignore
  checks.api.responseTimeMs = Date.now() - startedAt;

  const isHealthy = checks.database.status === "ok";
  const response = {
    version: os.hostname(),
    status: isHealthy ? "ok" : "degraded",
    checks,
    system: getSystemInfo(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  return res.status(isHealthy ? 200 : 503).json(response);
});

export default status_check;
