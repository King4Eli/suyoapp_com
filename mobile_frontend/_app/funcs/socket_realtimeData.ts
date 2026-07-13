
//socket.io client example
import { io } from "socket.io-client";
import { hostServer } from "./functions";
import { _http_request } from "./functions";
import { sessionManager } from "./SessionContext";
export class SocketClient {
    private static socket: any;
    private static callbacks: Map<string, Function> = new Map();
    // Secondary subscribers (e.g. a focused Conversations screen watching connection/
    // presence events) that get every dispatch alongside the primary per-user callback.
    private static listeners: Map<string, Function> = new Map();

    private static dispatch(payload: any) {
        for (const callback of this.callbacks.values()) {
            callback(payload);
        }
        for (const listener of this.listeners.values()) {
            listener(payload);
        }
    }

    static addListener(id: string, callback: (data: any) => void) {
        this.listeners.set(id, callback);
    }

    static removeListener(id: string) {
        this.listeners.delete(id);
    }

    static isConnected() {
        return Boolean(this.socket?.connected);
    }

    // Direct socket.io emit (join/leave rooms etc.) -- distinct from emit() below,
    // which relays through the HTTP API instead of the live socket connection.
    static socketEmit(event: string, data?: any) {
        this.socket?.emit(event, data);
    }

    static connect(userID: string, callback?: (data: any) => void) {
        console.log(`🟨 [SOCKET] connect() called -> userID=${userID} host=${hostServer()} alreadyConnected=${Boolean(this.socket?.connected)}`);
        if (this.socket && this.socket.connected) {
            console.log('Socket already connected');
            if (callback) {
                callback({ connected: true, socketId: this.socket.id });
            }
            return this.socket;
        }

        // Disconnect existing socket if exists
        if (this.socket) {
            this.socket.disconnect();
        }

        // The server derives identity from the session, not from the client-supplied
        // userID -- that's only kept here for local callback bookkeeping/logging.
        // `auth` as a function (not a plain object) is required here: socket.io calls
        // it fresh on every connect/reconnect attempt, so a token that wasn't ready yet
        // (or that's since been renewed) is picked up instead of being sent stale forever.
        this.socket = io(hostServer(), {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
            auth: (cb: (data: any) => void) => {
                const currentSession = sessionManager.getCurrentSession();
                console.log(`🟨 [SOCKET] auth() handshake fn invoked -> hasToken=${Boolean(currentSession?.x_omi_payload)} hasHash=${Boolean(currentSession?.x_omi_payload_hash)}`);
                cb({
                    auth_token: currentSession?.x_omi_payload,
                    auth_hash: currentSession?.x_omi_payload_hash,
                });
            },
            path: '/socket.io/', // Use default path
        });

        // Store callback for user
        if (callback) {
            const callbackId = `user-${userID}`;
            this.callbacks.set(callbackId, callback);
        }

        this.registerEvents(userID);
        return this.socket;
    }
    static emit(event: string, data: any) {
        console.log(`🟦 [SOCKET][HTTP] emit OUT -> ${hostServer()}/api/realtime${event}`, JSON.stringify(data));
        const yy = _http_request({
            reqType: 'POST',
            customApiUrl: hostServer() + '/api/realtime'+event,
            bodyArray: {
                message: data
            }
        });
        yy.then((res: any) => console.log(`🟩 [SOCKET][HTTP] emit RESPONSE <- ${event}`, JSON.stringify(res)))
          .catch((err: any) => console.log(`🟥 [SOCKET][HTTP] emit ERROR <- ${event}`, err?.message ?? err));
    }

    private static registerEvents(userID: string) {
        if (!this.socket) return;

        // Log every single event the socket receives, before any specific handling.
        this.socket.onAny((eventName: string, ...args: any[]) => {
            console.log(`🟦 [SOCKET] EVENT IN <- userID=${userID} event="${eventName}"`, JSON.stringify(args));
        });

        this.socket.on('connect', () => {
            console.log('✅ Connected! Socket ID:', this.socket.id);
            console.log('Transport:', this.socket.io.engine.transport.name);

            this.dispatch({
                connected: true,
                socketId: this.socket.id,
                userID: userID,
                event: 'connect'
            });
        });

        this.socket.on('connected', (data: any) => {
            this.dispatch({
                ...data,
                event: 'connected'
            });
        });

        this.socket.on('connect_error', (error: any) => {
            console.log('🔴 Connection error:', error.message);

            this.dispatch({
                error: error.message,
                event: 'connect_error',
                connected: false
            });

            // Fallback transport handling
            if (this.socket.io.opts.transports?.[0] === 'websocket') {
                this.socket.io.opts.transports = ['polling', 'websocket'];
            }
        });

        this.socket.on('message', (msg: any) => {
            this.dispatch({
                ...msg,
                event: 'message'
            });
        });

        this.socket.on('user-message', (data: any) => {
            this.dispatch({
                ...data,
                event: 'user-message'
            });
        });

        this.socket.on('broadcast', (data: any) => {
            this.dispatch({
                ...data,
                event: 'broadcast'
            });
        });

        // Handle any other events dynamically
        this.socket.onAny((event: string, data: any) => {
            if (!['connect', 'connected', 'connect_error', 'message', 'user-message', 'broadcast'].includes(event)) {
                // console.log(`📨 Event [${event}]:`, data);
                this.dispatch({
                    ...data,
                    event: event
                });
            }
        });

        this.socket.on('disconnect', (reason: any) => {
            console.log('🔌 Disconnected:', reason);

            this.dispatch({
                event: 'disconnect',
                reason: reason,
                connected: false
            });
        });
    }

    static getSocket() {
        return this.socket;
    }

    static disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.callbacks.clear();
            this.listeners.clear();
            //console.log('Socket disconnected and callbacks cleared');
        }
    }

    // Add this method to remove specific callbacks
    static removeCallback(userID: string) {
        const callbackId = `user-${userID}`;
        this.callbacks.delete(callbackId);
    }
}



// Usage examples:
// 1. Basic connection with callback
// SocketClient.connect("user-123", (data) => {
//   console.log('Received data:', data);
//   if (data.event === 'message') {
//     // Handle message
//   }
// });

// 2. Notify a match partner of a new message (relayed server-side via /api/realtime/pushUser/:userID)
// SocketClient.emit("/pushUser/" + otherUserId, { matchId, type: "single-convo", payload: { ... } });

// 3. Disconnect
// SocketClient.disconnect();