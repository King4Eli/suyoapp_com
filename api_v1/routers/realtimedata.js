import express from 'express';
const realtimedata_router = express.Router();

// HTTP endpoint for user-specific socket info
realtimedata_router.get('/pull/:userID', async (req, res) => {
    const { userID } = req.params;
    const io = req.app.get('io');
    try {
        // Get sockets in this user's room
        const sockets = await io.in(`user-${userID}`).fetchSockets();
        const activeConnections = sockets.map((/** @type {{ id: any; handshake: { time: any; }; rooms: Iterable<any> | ArrayLike<any>; }} */ 
            socket) => ({
            id: socket.id,
            connectedAt: socket.handshake.time,
            rooms: Array.from(socket.rooms)
        }));
        res.json({
            code: 200,
            userID,
            activeConnections: activeConnections.length,
            connections: activeConnections,
            socketUrl: `/api/socket/socket.io`
        });
    }
    catch (error) {
        res.status(500).json({
            code: 500,
            // @ts-ignore
            error: error.message
        });
    }
});

// Send message to specific user via HTTP
realtimedata_router.post('/pushUser/:userID', async (req, res) => {
    const { userID } = req.params;
    if (!req.body) {
        return res.status(400).json({ code: 400, message: "Message content is required" });
    }
    const { message, event = 'message' } = req.body;
    const io = req.app.get('io');
    try {
        io.to(`user-${userID}`).emit(event, {
            from: 'server',
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
        res.status(500).json({
            code: 500,
            // @ts-ignore
            error: error.message
        });
    }
});

// Broadcast to all users
realtimedata_router.post('/broadcast', async (req, res) => {
    const { message, event = 'broadcast' } = req.body;
    const io = req.app.get('io');
    try {
        io.emit(event, {
            from: 'server',
            message,
            timestamp: new Date().toISOString()
        });
        res.json({
            code: 200,
            message: 'Broadcast sent to all connected users'
        });
    }
    catch (error) {
        res.status(500).json({
            code: 500,
            // @ts-ignore
            error: error.message
        });
    }
});

// Get all connected users
realtimedata_router.get('/pullall', async (req, res) => {
    const io = req.app.get('io');
    try {
        const sockets = await io.fetchSockets();
        const users = new Set();
        sockets.forEach((/** @type {{ rooms: any[]; }} */ socket) => {
            // Extract user IDs from room names
            socket.rooms.forEach((/** @type {string} */ room) => {
                if (room.startsWith('user-')) {
                    users.add(room.replace('user-', ''));
                }
            });
        });
        res.json({
            code: 200,
            totalConnections: sockets.length,
            connectedUsers: Array.from(users),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            code: 500,
            // @ts-ignore
            error: error.message
        });
    }
});

// check status
// Debug endpoint to check Socket.IO status
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
      j: [
        "/socket.io/", "/status", "/api/realtime"
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// Socket.IO setup function
/**
 * @param {import("socket.io").Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>} io
 */
export function setupRealtime(io) {
    io.on('connection', (socket) => {
        //console.log('User connected:', socket.id);
        // Extract userID from handshake query
        const { userID } = socket.handshake.query;
        if (userID) {
            // Join user-specific room
            socket.join(`user-${userID}`);
            //console.log(`User ${userID} (${socket.id}) joined their room`);
            // Notify the user they're connected
            socket.emit('connected', {
                userID,
                socketId: socket.id,
                message: 'Successfully connected to socket server'
            });
            // Notify others in the room (optional)
            socket.to(`user-${userID}`).emit('user-connected', {
                userID,
                socketId: socket.id
            });
        }
        // Join custom rooms
        socket.on('join-room', (room) => {
            socket.join(room);
            //console.log(`Socket ${socket.id} joined room ${room}`);
        });
        // Leave room
        socket.on('leave-room', (room) => {
            socket.leave(room);
            //console.log(`Socket ${socket.id} left room ${room}`);
        });
        // Send message to room
        socket.on('send-to-room', ({ room, event, data }) => {
            io.to(room).emit(event || 'room-message', {
                from: socket.id,
                ...data,
                timestamp: new Date().toISOString()
            });
        });
        // Send message to user
        socket.on('send-to-user', ({ userID, event, data }) => {
            io.to(`user-${userID}`).emit(event || 'user-message', {
                from: socket.id,
                to: userID,
                ...data,
                timestamp: new Date().toISOString()
            });
        });
        // Handle custom user events
        socket.on('user-event', (data) => {
            const { userID, event, payload } = data;
            if (userID && event) {
                io.to(`user-${userID}`).emit(event, {
                    ...payload,
                    from: socket.id,
                    timestamp: new Date().toISOString()
                });
            }
        });
        // Heartbeat/ping
        socket.on('ping', () => {
            socket.emit('pong', {
                timestamp: new Date().toISOString()
            });
        });
        // Disconnect handler
        socket.on('disconnect', (reason) => {
            //console.log('User disconnected:', socket.id, 'Reason:', reason);
            if (userID) {
                // Notify others in the user's room
                socket.to(`user-${userID}`).emit('user-disconnected', {
                    userID,
                    socketId: socket.id,
                    reason
                });
            }
        });
        // Error handler
        socket.on('error', (error) => {
            console.error('🔴 Socket error:', socket.id, error);
        });
    });
}
export default realtimedata_router;
