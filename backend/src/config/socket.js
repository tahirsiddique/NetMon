const { Server } = require('socket.io');
const { AuthService } = require('../middleware/auth');

let io;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  const authService = new AuthService();

  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const user = authService.verifyToken(token);
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✓ Client connected: ${socket.user.username} (${socket.id})`);

    // Join user-specific room for notifications
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log(`✗ Client disconnected: ${socket.user.username} (${socket.id})`);
    });

    // Handle subscription to specific nodes
    socket.on('subscribe:nodes', (nodeIds) => {
      if (Array.isArray(nodeIds)) {
        nodeIds.forEach(nodeId => {
          socket.join(`node:${nodeId}`);
        });
        console.log(`Client ${socket.user.username} subscribed to ${nodeIds.length} nodes`);
      }
    });

    // Handle unsubscription
    socket.on('unsubscribe:nodes', (nodeIds) => {
      if (Array.isArray(nodeIds)) {
        nodeIds.forEach(nodeId => {
          socket.leave(`node:${nodeId}`);
        });
      }
    });

    // Acknowledge connection
    socket.emit('connected', {
      message: 'Connected to Digiskills Monitor',
      user: socket.user.username,
      timestamp: new Date()
    });
  });

  console.log('✓ WebSocket server initialized');
  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
}

// Broadcast helpers
function broadcastMetricUpdate(nodeId, data) {
  if (io) {
    io.to(`node:${nodeId}`).emit('metric:update', {
      node_id: nodeId,
      data,
      timestamp: new Date()
    });
  }
}

function broadcastAlert(alert) {
  if (io) {
    // Broadcast to all connected clients
    io.emit('alert:new', alert);
  }
}

function broadcastStatusChange(nodeId, status) {
  if (io) {
    io.to(`node:${nodeId}`).emit('status:change', {
      node_id: nodeId,
      status,
      timestamp: new Date()
    });
  }
}

module.exports = {
  initializeSocket,
  getIO,
  broadcastMetricUpdate,
  broadcastAlert,
  broadcastStatusChange
};
