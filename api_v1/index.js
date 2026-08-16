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
import { startExpirePendingPaymentsJob } from "./global/expirePendingPayments.js";
import { sessions } from "./global/sessions.js";

const http_port = 80;
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

// Periodically expire checkout attempts that were never completed
startExpirePendingPaymentsJob();

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
  res.status(500).json({ error: err.message });
});

// Start server with explicit host
httpServer.listen(http_port, "0.0.0.0", () => {
  console.log(`⚪ 📡success io Waiting for connections...`);
});

// Log when server closes
httpServer.on("close", () => {
  console.log("🟡 Server closed");
});

// Log connection errors
httpServer.on("clientError", (err, socket) => {
  console.error("🔴 Client error:", err.message);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

app.use((req, res) => {
  res.status(404).send("404 Not Found");
});
