import express from "express";
import http from "http";
import { Server } from "socket.io";
import login_router from "./routers/auth/login.js";
import signup_router from "./routers/auth/signup.js";
import core_router from "./routers/core.js";
import pay_router from "./routers/pay.js";
import realtimedata_router, { setupRealtime } from "./routers/realtimedata.js";
import webhook_router from "./routers/payments/router_hook.js";
import status_check from "./routers/status.js";
import { sessions } from "./global/sessions.js";
import { tools } from "./global/functions.js";
import { BUILD_HASH, BUILD_SHORT } from "./global/buildInfo.js";

// Builds the Express app, HTTP server and Socket.IO server without starting
// anything: index.js listens and starts the background jobs; the API tests
// (test/) listen on a random port against a throwaway database.

const app = express();

// This container has no public port mapping in production (see docker-compose.yml) --
// it's only reachable through the shared reverse proxy on shared-global-network. Without
// this, req.ip resolves to the proxy's address for every request, which would collapse
// all users onto a single IP-based rate-limit bucket. Trusts exactly one hop; if another
// proxy/CDN sits in front of that one, bump this to match the real hop count.
app.set("trust proxy", 1);

// Gives every request its own isolated sessions.currentUserID store (see
// global/functions.js) so concurrent requests can never read/overwrite each
// other's user id across an await. Must be the very first middleware so it
// wraps the entire request lifecycle, including the webhook route below.
app.use((req, res, next) => sessions.runInContext(next));

// Every response says which API build answered, so the app can drop cached
// server data (mapper, products, profile...) when a new build is deployed.
app.use((req, res, next) => {
  res.setHeader("X-Api-Build", BUILD_HASH);
  next();
});

app.use(
  "/api/secure/stripe/webhook",
  express.raw({ type: "application/json" }),
  webhook_router,
);
app.use(express.json());

// Create HTTP server
const httpServer = http.createServer(app);
// Configure Socket.IO with default settings (no custom path)
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for debugging
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Use default path ('/socket.io/') - remove custom path
  // path: '/api/socket/socket.io',

  // WebSocket configuration
  transports: ["websocket", "polling"], // Enable both
  allowUpgrades: true,
  upgradeTimeout: 10000,

  // Timeout settings
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,

  // Memory limits
  maxHttpBufferSize: 1e6, // 1MB

  // Allow older clients
  allowEIO3: true,
});
// Make io accessible to routes
app.set("io", io);
// Setup Socket.IO realtime handlers
setupRealtime(io);

app.use("/s", status_check);
app.use("/api/login", login_router);
app.use("/api/signup", signup_router);
app.use("/api/core/v1", core_router);
app.use("/api/secure/gateway", pay_router);
// Mount realtimedata router
app.use("/api/realtime", realtimedata_router);

// Error handling
// @ts-ignore
app.use((err, req, res, _next) => {
  console.error("🔴 Error:", err);
  // Unhandled route error: record it with the build that produced it.
  tools.serverLog(
    `Unhandled error on ${req.method} ${req.originalUrl}: ${err?.stack || err}`,
    "unhandled",
  );
  res.status(500).json({ error: err.message, build: BUILD_SHORT });
});

app.use((req, res) => {
  res.status(404).send("404 Not Found");
});

export { app, httpServer, io };
