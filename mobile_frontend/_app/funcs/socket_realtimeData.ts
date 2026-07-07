
//socket.io client example
import { io } from "socket.io-client";
import { hostServer } from "./functions";
import { _http_request } from "./functions";
export class SocketClient {
    private static socket: any;
    private static callbacks: Map<string, Function> = new Map();

    static connect(userID: string, callback?: (data: any) => void) {
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

        // Connect with the provided userID
        this.socket = io(hostServer(), {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
            query: {
                userID: userID,
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
        const yy= _http_request({
            reqType: 'POST',
            customApiUrl: hostServer() + '/api/realtime'+event,
            bodyArray: {  
                message: data  
            }
        });
        //console.log("Emit response:", yy);
            // Handle response if needed
    }

    private static registerEvents(userID: string) {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ Connected! Socket ID:', this.socket.id);
            console.log('Transport:', this.socket.io.engine.transport.name);

            // Trigger callback on connect
            const callbackId = `user-${userID}`;
            const callback = this.callbacks.get(callbackId);
            if (callback) {
                callback({
                    connected: true,
                    socketId: this.socket.id,
                    userID: userID,
                    event: 'connect'
                });
            }
        });

        this.socket.on('connected', (data: any) => {

            // Trigger callback on server welcome
            const callbackId = `user-${userID}`;
            const callback = this.callbacks.get(callbackId);
            if (callback) {
                callback({
                    ...data,
                    event: 'connected'
                });
            }
        });

        this.socket.on('connect_error', (error: any) => {
            console.log('🔴 Connection error:', error.message);

            // Trigger callback on error
            const callbackId = `user-${userID}`;
            const callback = this.callbacks.get(callbackId);
            if (callback) {
                callback({
                    error: error.message,
                    event: 'connect_error',
                    connected: false
                });
            }

            // Fallback transport handling
            if (this.socket.io.opts.transports?.[0] === 'websocket') {
                this.socket.io.opts.transports = ['polling', 'websocket'];
            }
        });

        this.socket.on('message', (msg: any) => {

            // Trigger callback on message
            const callbackId = `user-${userID}`;
            const callback = this.callbacks.get(callbackId);
            if (callback) {
                callback({
                    ...msg,
                    event: 'message'
                });
            }
        });

        this.socket.on('user-message', (data: any) => {

            const callbackId = `user-${userID}`;
            const callback = this.callbacks.get(callbackId);
            if (callback) {
                callback({
                    ...data,
                    event: 'user-message'
                });
            }
        });

        this.socket.on('broadcast', (data: any) => {

            const callbackId = `user-${userID}`;
            const callback = this.callbacks.get(callbackId);
            if (callback) {
                callback({
                    ...data,
                    event: 'broadcast'
                });
            }
        });

        // Handle any other events dynamically
        this.socket.onAny((event: string, data: any) => {
            if (!['connect', 'connected', 'connect_error', 'message', 'user-message', 'broadcast'].includes(event)) {
                // console.log(`📨 Event [${event}]:`, data);

                const callbackId = `user-${userID}`;
                const callback = this.callbacks.get(callbackId);
                if (callback) {
                    callback({
                        ...data,
                        event: event
                    });
                }
            }
        });

        this.socket.on('disconnect', (reason: any) => {
            console.log('🔌 Disconnected:', reason);

            const callbackId = `user-${userID}`;
            const callback = this.callbacks.get(callbackId);
            if (callback) {
                callback({
                    event: 'disconnect',
                    reason: reason,
                    connected: false
                });
            }
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

// 2. Send message to room
// const socket = SocketClient.getSocket();
// socket.emit('send-to-room', {
//   room: 'room-name',
//   event: 'custom-event',
//   data: { text: 'Hello room!' }
// });

// 3. Send message to user
// socket.emit('send-to-user', {
//   userID: 'target-user-id',
//   event: 'private-message',
//   data: { text: 'Hello!' }
// });

// 4. Disconnect
// SocketClient.disconnect();