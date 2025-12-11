const { Server } = require('socket.io');

class SocketService {
    constructor() {
        this.io = null;
        this.connectedClients = new Map();
    }

    /**
     * Initialize Socket.io server
     * @param {http.Server} server - HTTP server instance
     */
    initialize(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.NODE_ENV === 'production' ? false : '*',
                credentials: true
            }
        });

        this.io.on('connection', (socket) => {
            console.log(`✅ Socket connected: ${socket.id}`);
            this.connectedClients.set(socket.id, socket);

            // Subscribe to job updates
            socket.on('subscribe:job', ({ jobId }) => {
                socket.join(`job:${jobId}`);
                console.log(`📡 Client ${socket.id} subscribed to job ${jobId}`);
            });

            // Subscribe to stream updates
            socket.on('subscribe:stream', ({ streamId }) => {
                socket.join(`stream:${streamId}`);
                console.log(`📡 Client ${socket.id} subscribed to stream ${streamId}`);
            });

            // Subscribe to upload progress
            socket.on('subscribe:upload', ({ uploadId }) => {
                socket.join(`upload:${uploadId}`);
                console.log(`📡 Client ${socket.id} subscribed to upload ${uploadId}`);
            });

            socket.on('disconnect', () => {
                console.log(`❌ Socket disconnected: ${socket.id}`);
                this.connectedClients.delete(socket.id);
            });
        });

        console.log('✅ Socket.io initialized');
    }

    /**
     * Emit job progress update
     */
    emitJobProgress(jobId, data) {
        if (!this.io) return;
        this.io.to(`job:${jobId}`).emit('job:progress', {
            jobId,
            progress: data.progress,
            status: data.status,
            message: data.message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Emit job completion
     */
    emitJobCompleted(jobId, result) {
        if (!this.io) return;
        this.io.to(`job:${jobId}`).emit('job:completed', {
            jobId,
            result,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Emit job failure
     */
    emitJobFailed(jobId, error) {
        if (!this.io) return;
        this.io.to(`job:${jobId}`).emit('job:failed', {
            jobId,
            error: error.message || error,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Emit stream status update
     */
    emitStreamStatus(streamId, data) {
        if (!this.io) return;
        this.io.to(`stream:${streamId}`).emit('stream:status', {
            streamId,
            status: data.status,
            stats: data.stats,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Emit upload progress
     */
    emitUploadProgress(uploadId, data) {
        if (!this.io) return;
        this.io.to(`upload:${uploadId}`).emit('upload:progress', {
            uploadId,
            bytesUploaded: data.bytesUploaded,
            totalBytes: data.totalBytes,
            progress: Math.round((data.bytesUploaded / data.totalBytes) * 100),
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get Socket.io instance
     */
    getIO() {
        return this.io;
    }
}

// Singleton instance
const socketService = new SocketService();

module.exports = socketService;
