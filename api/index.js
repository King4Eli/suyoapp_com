import { httpServer, io } from "./app.js";
import { startExpirePendingPaymentsJob } from "./global/expirePendingPayments.js";
import { startVerificationEmailJob } from "./global/notifyEmail.js";
import { BUILD_HASH } from "./global/buildInfo.js";

const http_port = 80;

// Periodically expire checkout attempts that were never completed
startExpirePendingPaymentsJob();
startVerificationEmailJob(io);

// Start server with explicit host
httpServer.listen(http_port, "0.0.0.0", () => {
  console.log(
    `⚪ 📡success io Waiting for connections... (build ${BUILD_HASH})`,
  );
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
