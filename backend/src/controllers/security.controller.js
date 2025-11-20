const auditLogger = require('../services/audit-logger');
const { getActiveSessions, revokeSession } = require('../middleware/security');

/**
 * Get audit logs with filtering
 */
async function getAuditLogs(req, res) {
  try {
    const {
      startDate,
      endDate,
      userId,
      username,
      eventType,
      severity,
      resource,
      status,
      limit = 100,
      offset = 0
    } = req.query;

    const logs = await auditLogger.getLogs({
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      userId,
      username,
      eventType,
      severity,
      resource,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: logs.length
      }
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      error: 'Failed to retrieve audit logs'
    });
  }
}

/**
 * Get audit statistics
 */
async function getAuditStatistics(req, res) {
  try {
    const { timeRange = '24h' } = req.query;

    const stats = await auditLogger.getStatistics(timeRange);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get audit statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve audit statistics'
    });
  }
}

/**
 * Get user activity summary
 */
async function getUserActivity(req, res) {
  try {
    const { userId } = req.params;
    const { timeRange = '7d' } = req.query;

    const activity = await auditLogger.getUserActivity(userId, timeRange);

    res.json({
      success: true,
      data: activity
    });

  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      error: 'Failed to retrieve user activity'
    });
  }
}

/**
 * Get current user's activity
 */
async function getMyActivity(req, res) {
  try {
    const { timeRange = '7d' } = req.query;

    const activity = await auditLogger.getUserActivity(req.user.id, timeRange);

    res.json({
      success: true,
      data: activity
    });

  } catch (error) {
    console.error('Get my activity error:', error);
    res.status(500).json({
      error: 'Failed to retrieve activity'
    });
  }
}

/**
 * Get active sessions for current user
 */
async function getMySessions(req, res) {
  try {
    const sessions = await getActiveSessions(req.user.id);

    res.json({
      success: true,
      data: sessions
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to retrieve sessions'
    });
  }
}

/**
 * Revoke a session
 */
async function revokeSessionById(req, res) {
  try {
    const { sessionId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(400).json({
        error: 'No token provided'
      });
    }

    await revokeSession(req.user.id, token);

    await auditLogger.log({
      eventType: 'security.session.revoked',
      userId: req.user.id,
      username: req.user.username,
      ipAddress: auditLogger.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      action: 'revoke_session',
      status: 'success',
      severity: 'info',
      details: `Session ${sessionId} revoked`,
      metadata: { sessionId }
    });

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });

  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      error: 'Failed to revoke session'
    });
  }
}

/**
 * Get security dashboard data
 */
async function getSecurityDashboard(req, res) {
  try {
    const { timeRange = '24h' } = req.query;

    const [stats, recentLogs] = await Promise.all([
      auditLogger.getStatistics(timeRange),
      auditLogger.getLogs({ limit: 10, severity: 'error' })
    ]);

    res.json({
      success: true,
      data: {
        statistics: stats,
        recentErrors: recentLogs
      }
    });

  } catch (error) {
    console.error('Get security dashboard error:', error);
    res.status(500).json({
      error: 'Failed to retrieve security dashboard'
    });
  }
}

/**
 * Export audit logs (admin only)
 */
async function exportAuditLogs(req, res) {
  try {
    const {
      startDate,
      endDate,
      format = 'json'
    } = req.query;

    const logs = await auditLogger.getLogs({
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      limit: 10000 // Max export limit
    });

    if (format === 'csv') {
      // Convert to CSV
      const headers = ['Created At', 'Event Type', 'Username', 'IP Address', 'Action', 'Status', 'Severity', 'Details'];
      const csv = [
        headers.join(','),
        ...logs.map(log => [
          log.created_at,
          log.event_type,
          log.username || '',
          log.ip_address || '',
          log.action || '',
          log.status,
          log.severity,
          `"${(log.details || '').replace(/"/g, '""')}"`
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      // Return as JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.json"`);
      res.json(logs);
    }

    // Log the export
    await auditLogger.log({
      eventType: 'security.audit.exported',
      userId: req.user.id,
      username: req.user.username,
      ipAddress: auditLogger.getIpAddress(req),
      action: 'export',
      status: 'success',
      severity: 'info',
      details: `Exported ${logs.length} audit log entries`,
      metadata: { format, startDate, endDate }
    });

  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({
      error: 'Failed to export audit logs'
    });
  }
}

module.exports = {
  getAuditLogs,
  getAuditStatistics,
  getUserActivity,
  getMyActivity,
  getMySessions,
  revokeSessionById,
  getSecurityDashboard,
  exportAuditLogs
};
