import jwt from "jsonwebtoken";
import { AsyncLocalStorage } from "node:async_hooks";
import { envInt } from "./functions.js";

// Per-request store for "who is making this call". Node interleaves concurrent
// requests at every `await`, so a plain module-level variable here would let
// request A's session check be silently overwritten by request B's before A's
// later `await`-separated reads of currentUserID run -- a cross-user data leak
// (e.g. user A's profile query followed by user B's subscription/likes data).
// AsyncLocalStorage gives every request its own isolated store that survives
// across awaits regardless of how requests interleave.
const sessionContext = new AsyncLocalStorage();

export class sessions {
  // Wraps `fn` so every read/write of `currentUserID` inside it (however deep,
  // across however many awaits) lands in its own request-scoped store instead
  // of a store shared with concurrently in-flight requests. Must wrap request
  // handling (Express middleware, each socket connection/handshake) before
  // verifyFullSession is ever called.
  /**
   * @param {import("express-serve-static-core").NextFunction} fn
   */
  static runInContext(fn) {
    return sessionContext.run({ userId: null }, fn);
  }
  // Setter -- writes into the active request's store. If called with no
  // store active (i.e. not wrapped in runInContext), the value has nowhere
  // safe to go, so it's dropped rather than falling back to shared state.
  static set currentUserID(val) {
    const store = sessionContext.getStore();
    if (!store) {
      console.error(
        "🔴 sessions.currentUserID set outside of runInContext() -- value dropped to avoid cross-request leakage",
      );
      return;
    }
    store.userId = val;
  }
  // Getter
  static get currentUserID() {
    return sessionContext.getStore()?.userId ?? null;
  }
  // Create session -- a standard signed (not encrypted) JWT. Its claims
  // (user_id, exp) are base64url-readable by anyone holding the token, same
  // as any typical JWT-based session; that's fine because transport is
  // HTTPS and the token itself is already the bearer credential regardless
  // of whether its claims are legible. What HS256 guarantees is that it
  // can't be tampered with or forged without SESSION_ENCRYPT_HASH.
  //@ts-ignore
  static createSession(userId) {
    if (!process.env.SESSION_ENCRYPT_HASH) {
      throw new Error(
        "SESSION_ENCRYPT_HASH must be set -- refusing to issue an unsigned/forgeable session token.",
      );
    }
    return jwt.sign(
      { user_id: userId },
      process.env.SESSION_ENCRYPT_HASH,
      { algorithm: "HS256", expiresIn: envInt("SESSION_TTL_SECONDS", 923567) }, // ~10 days
    );
  }

  // Verifies signature + expiry in one step (jwt.verify does both) and,
  // on success, populates the calling request's currentUserID. Must run
  // inside sessions.runInContext() (see above) so that write has a
  // request-scoped store to land in.
  static verifyFullSession(auth_token = "") {
    if (!auth_token) {
      return {
        status: false,
        code: 400,
        message: "Authentication token is required.",
      };
    }

    if (!process.env.SESSION_ENCRYPT_HASH) {
      return { status: false, code: 500, message: "Unable to verify session#" };
    }

    try {
      const decoded = jwt.verify(auth_token, process.env.SESSION_ENCRYPT_HASH, {
        algorithms: ["HS256"],
      });
      // @ts-ignore
      this.currentUserID = decoded.user_id;
      return { status: true, code: 200, message: "Authorized" };
    } catch {
      this.currentUserID = null;
      return { status: false, code: 401, message: "Unauthorized" };
    }
  }
}
