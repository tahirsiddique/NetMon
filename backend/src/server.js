const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
require('dotenv').config();

// Import configurations
const { pool } = require('./config/database');
const { initializeSocket } = require('./config/socket');

// Import middleware
const { authenticateJWT, requireRole } = require('./middleware/auth');

// Import controllers
const authController = require('./controllers/auth.controller');
const nodesController = require('./controllers/nodes.controller');
const dashboardController = require('./controllers/dashboard.controller');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize WebSocket
const io = initializeSocket(server);

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');

    res.json({
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      database: 'connected',
      websocket: 'active'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// API Routes

// Authentication routes
app.post('/api/auth/login', authController.loginValidation, authController.login);
app.post('/api/auth/logout', authenticateJWT, authController.logout);
app.get('/api/auth/verify', authenticateJWT, authController.verifyToken);
app.get('/api/auth/profile', authenticateJWT, authController.getProfile);

// Dashboard routes
app.get('/api/dashboard/overview', authenticateJWT, dashboardController.getDashboardOverview);
app.get('/api/dashboard/metrics-summary', authenticateJWT, dashboardController.getMetricsSummary);
app.get('/api/dashboard/activity', authenticateJWT, dashboardController.getRecentActivity);

// Nodes routes
app.get('/api/nodes', authenticateJWT, nodesController.getAllNodes);
app.get('/api/nodes/stats', authenticateJWT, nodesController.getNodeStats);
app.get('/api/nodes/:id', authenticateJWT, nodesController.getNodeById);
app.get('/api/nodes/type/:type', authenticateJWT, nodesController.getNodesByType);

// Admin-only node management routes
app.post('/api/nodes', authenticateJWT, requireRole('admin'), nodesController.createNode);
app.put('/api/nodes/:id', authenticateJWT, requireRole('admin'), nodesController.updateNode);
app.delete('/api/nodes/:id', authenticateJWT, requireRole('admin'), nodesController.deleteNode);

// Metrics routes (placeholder - will be implemented in Phase 2)
app.post('/api/metrics/time-series', authenticateJWT, (req, res) => {
  res.json({
    success: true,
    message: 'Metrics endpoint - to be implemented in Phase 2',
    timestamps: [],
    series: []
  });
});

// Internet usage routes (placeholder - will be implemented in Phase 3)
app.get('/api/internet-usage/top-users', authenticateJWT, (req, res) => {
  res.json({
    success: true,
    message: 'Internet usage endpoint - to be implemented in Phase 3',
    data: []
  });
});

// Alerts routes (placeholder - will be implemented in Phase 6)
app.get('/api/alerts', authenticateJWT, (req, res) => {
  res.json({
    success: true,
    message: 'Alerts endpoint - to be implemented in Phase 6',
    data: []
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('\n================================');
  console.log('🚀 Digiskills Network Monitor');
  console.log('================================');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ API URL: http://localhost:${PORT}/api`);
  console.log(`✓ Health Check: http://localhost:${PORT}/health`);
  console.log('================================\n');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

module.exports = { app, server, io };
