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
const metricsController = require('./controllers/metrics.controller');
const internetUsageController = require('./controllers/internet-usage.controller');
const zabbixController = require('./controllers/zabbix.controller');
const alertsController = require('./controllers/alerts.controller');
const securityController = require('./controllers/security.controller');

// Import security middleware
const { requestLogger, checkLoginLockout } = require('./middleware/security');

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

// Enhanced request logging middleware
app.use(requestLogger);

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
app.post('/api/auth/login', checkLoginLockout, authController.loginValidation, authController.login);
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

// Metrics routes
app.post('/api/metrics/time-series', authenticateJWT, metricsController.getTimeSeriesData);
app.get('/api/metrics/node/:nodeId', authenticateJWT, metricsController.getNodeMetrics);
app.get('/api/metrics/node/:nodeId/available', authenticateJWT, metricsController.getAvailableMetrics);
app.get('/api/metrics/node/:nodeId/:metricType/latest', authenticateJWT, metricsController.getLatestMetric);
app.get('/api/metrics/node/:nodeId/:metricType/stats', authenticateJWT, metricsController.getMetricStats);
app.get('/api/metrics/node/:nodeId/services', authenticateJWT, metricsController.getServiceStatus);
app.get('/api/metrics/node/:nodeId/hardware', authenticateJWT, metricsController.getHardwareHealth);

// Internet usage routes
app.get('/api/internet-usage/top-users', authenticateJWT, internetUsageController.getTopUsers);
app.get('/api/internet-usage/user/:username', authenticateJWT, internetUsageController.getUserUsage);
app.get('/api/internet-usage/protocols', authenticateJWT, internetUsageController.getUsageByProtocol);
app.get('/api/internet-usage/time-series', authenticateJWT, internetUsageController.getUsageTimeSeries);
app.get('/api/internet-usage/destinations', authenticateJWT, internetUsageController.getTopDestinations);
app.get('/api/internet-usage/stats', authenticateJWT, internetUsageController.getOverallStats);
app.get('/api/internet-usage/search', authenticateJWT, internetUsageController.searchUsers);
app.get('/api/internet-usage/export', authenticateJWT, internetUsageController.exportCSV);
app.get('/api/internet-usage/resolver/stats', authenticateJWT, internetUsageController.getResolverStats);
app.post('/api/internet-usage/resolver/clear', authenticateJWT, requireRole('admin'), internetUsageController.clearResolverCache);

// Zabbix integration routes
app.get('/api/zabbix/test', authenticateJWT, requireRole('admin'), zabbixController.testConnection);
app.post('/api/zabbix/sync', authenticateJWT, requireRole('admin'), zabbixController.syncInternetLinks);
app.get('/api/zabbix/links', authenticateJWT, zabbixController.getInternetLinks);
app.get('/api/zabbix/links/stats', authenticateJWT, zabbixController.getInternetLinksStats);
app.get('/api/zabbix/links/by-type', authenticateJWT, zabbixController.getLinksByType);
app.get('/api/zabbix/links/:id', authenticateJWT, zabbixController.getInternetLinkById);
app.get('/api/zabbix/links/host/:hostId', authenticateJWT, zabbixController.getInternetLinkByHostId);
app.get('/api/zabbix/links/host/:hostId/history', authenticateJWT, zabbixController.getLinkBandwidthHistory);
app.put('/api/zabbix/links/:id', authenticateJWT, requireRole('admin'), zabbixController.updateLink);
app.get('/api/zabbix/problems', authenticateJWT, zabbixController.getActiveProblems);

// Alerts routes
app.get('/api/alerts', authenticateJWT, alertsController.getAlerts);
app.get('/api/alerts/statistics', authenticateJWT, alertsController.getAlertStatistics);
app.get('/api/alerts/:id', authenticateJWT, alertsController.getAlertById);
app.post('/api/alerts/:id/acknowledge', authenticateJWT, alertsController.acknowledgeAlert);
app.post('/api/alerts/:id/resolve', authenticateJWT, alertsController.resolveAlert);

// Alert rules routes
app.get('/api/alert-rules', authenticateJWT, alertsController.getAlertRules);
app.get('/api/alert-rules/:id', authenticateJWT, alertsController.getAlertRuleById);
app.post('/api/alert-rules', authenticateJWT, requireRole('admin'), alertsController.createAlertRule);
app.put('/api/alert-rules/:id', authenticateJWT, requireRole('admin'), alertsController.updateAlertRule);
app.delete('/api/alert-rules/:id', authenticateJWT, requireRole('admin'), alertsController.deleteAlertRule);
app.post('/api/alert-rules/evaluate', authenticateJWT, requireRole('admin'), alertsController.triggerRuleEvaluation);

// Email configuration test
app.post('/api/alerts/test-email', authenticateJWT, requireRole('admin'), alertsController.testEmailConfiguration);

// Security and audit routes
app.get('/api/security/audit-logs', authenticateJWT, requireRole('admin'), securityController.getAuditLogs);
app.get('/api/security/audit-logs/statistics', authenticateJWT, requireRole('admin'), securityController.getAuditStatistics);
app.get('/api/security/audit-logs/users/:userId/activity', authenticateJWT, requireRole('admin'), securityController.getUserActivity);
app.get('/api/security/my/activity', authenticateJWT, securityController.getMyActivity);
app.get('/api/security/my/sessions', authenticateJWT, securityController.getMySessions);
app.post('/api/security/sessions/:sessionId/revoke', authenticateJWT, securityController.revokeSessionById);
app.get('/api/security/dashboard', authenticateJWT, requireRole('admin'), securityController.getSecurityDashboard);
app.get('/api/security/audit-logs/export', authenticateJWT, requireRole('admin'), securityController.exportAuditLogs);

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
