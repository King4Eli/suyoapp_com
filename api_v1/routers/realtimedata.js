import express from 'express';
import { sessions, tools } from '../global/functions.js';
import db_pool from '../global/database.js';

const realtimedata_router = express.Router();

const blockedMatchStatuses = ["2", "3", "4"];

/**
 * Verifies the caller's session and that they're an active (non-blocked) match
 * participant with targetUserID -- the same authorization pushConversation.js
 * uses. This is the boundary for the chat-notification relay below: without it,
 * anyone could push a fabricated "new message" notification to any user.
 * @param {import('express').Request} req
 * @param {string} targetUserID
 * @param {string} matchId
 */
async function verifyActiveMatchWith(req, targetUserID, matchId) {
    const headers = req.headers;
    const auth_token = Array.isArray(headers['x-omi-auth']) ? headers['x-omi-auth'][0] : (headers['x-omi-auth'] ?? "");
    const auth_hash = Array.isArray(headers['x-omi-hash']) ? headers['x-omi-hash'][0] : (headers['x-omi-hash'] ?? "");

    const sessionValidation = sessions.verifyFullSession(auth_token, auth_hash);
    if (!sessionValidation.status) {
        return { ok: false, code: sessionValidation.code, message: sessionValidation.message };
    }
    const callerID = sessions.currentUserID;

    if (!matchId || !targetUserID) {
        return { ok: false, code: 400, message: "Missing matchId or target user." };
    }

    const [matchRows] = await db_pool.execute(
        "SELECT match_status FROM matches WHERE match_id = ? AND ((match_user_id_from = ? AND match_user_id_to = ?) OR (match_user_id_from = ? AND match_user_id_to = ?))",
        [matchId, callerID, targetUserID, targetUserID, callerID]
    );
    // @ts-ignore
    if (matchRows.length === 0) {
        return { ok: false, code: 404, message: "Match not found or no access." };
    }
    // @ts-ignore
    if (blockedMatchStatuses.includes(String(matchRows[0].match_status))) {
        return { ok: false, code: 403, message: "This match can no longer receive messages." };
    }
    return { ok: true, callerID };
}

// Relay a chat notification to a match partner's socket room. Used by
// SocketClient.emit() right after a message is persisted via pushConversation.
realtimedata_router.post('/pushUser/:userID', async (req, res) => {
    const { userID } = req.params;
    const { message, event = 'message' } = req.body ?? {};
    const matchId = message?.matchId;

    try {
        const auth = await verifyActiveMatchWith(req, userID, matchId);
        if (!auth.ok) {
            return res.status(auth.code).json({ code: auth.code, message: auth.message });
        }

        const io = req.app.get('io');
        io.to(`user-${userID}`).emit(event, {
            from: auth.callerID,
            to: userID,
            message,
            timestamp: new Date().toISOString()
        });
        res.json({
            code: 200,
            message: `Message sent to user ${userID}`,
            event
        });
    }
    catch (error) {
        tools.serverLog(`Error in realtimedata pushUser: ${error}`, "realtimedata-pushUser-0");
        res.status(500).json({ code: 500, message: "Internal error." });
    }
});

// Debug endpoint to check Socket.IO status (no per-user/connection data exposed)
realtimedata_router.get('/status', (req, res) => {
  const io = req.app.get('io');
  res.json({
    status: 'ok',
    socketio: {
      connectedClients: io.engine.clientsCount,
      path: io.opts.path,
      transports: io.opts.transports,
      pingInterval: io.opts.pingInterval,
      pingTimeout: io.opts.pingTimeout,
    },
    timestamp: new Date().toISOString()
  });
});

// Socket.IO setup function
/**
 * @param {import("socket.io").Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>} io
 */
export function setupRealtime(io) {
    // Authenticate every connection before it's accepted. The client identity
    // (userID) is derived from the verified session, never trusted from the client.
    io.use((socket, next) => {
        const auth = socket.handshake.auth ?? {};
        const auth_token = auth.auth_token ?? "";
        const auth_hash = auth.auth_hash ?? "";
        const validation = sessions.verifyFullSession(auth_token, auth_hash);
        if (!validation.status) {
            return next(new Error('Unauthorized'));
        }
        socket.data.userID = sessions.currentUserID;
        next();
    });

    io.on('connection', (socket) => {
        const userID = socket.data.userID;

        // Join the caller's own room -- the only room a socket ever belongs to.
        socket.join(`user-${userID}`);
        socket.emit('connected', {
            userID,
            socketId: socket.id,
            message: 'Successfully connected to socket server'
        });
        // Let the user's other devices/tabs know a new one connected.
        socket.to(`user-${userID}`).emit('user-connected', {
            userID,
            socketId: socket.id
        });

        // Heartbeat/ping
        socket.on('ping', () => {
            socket.emit('pong', {
                timestamp: new Date().toISOString()
            });
        });
        // Disconnect handler
        socket.on('disconnect', (reason) => {
            socket.to(`user-${userID}`).emit('user-disconnected', {
                userID,
                socketId: socket.id,
                reason
            });
        });
        // Error handler
        socket.on('error', (error) => {
            console.error('🔴 Socket error:', socket.id, error);
        });
    });
}
export default realtimedata_router;
