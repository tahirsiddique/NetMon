const { query } = require('../config/database');

/**
 * Audit Logger Service
 *
 * Comprehensive audit logging for security events, user actions, and system changes.
 */
class AuditLogger {
  constructor() {
    this.eventTypes = {
      // Authentication events
      AUTH_LOGIN_SUCCESS: 'auth.login.success',
      AUTH_LOGIN_FAILED: 'auth.login.failed',
      AUTH_LOGOUT: 'auth.logout',
      AUTH_TOKEN_EXPIRED: 'auth.token.expired',

      // User management
      USER_CREATED: 'user.created',
      USER_UPDATED: 'user.updated',
      USER_DELETED: 'user.deleted',
      USER_PASSWORD_CHANGED: 'user.password.changed',

      // Alert management
      ALERT_RULE_CREATED: 'alert.rule.created',
      ALERT_RULE_UPDATED: 'alert.rule.updated',
      ALERT_RULE_DELETED: 'alert.rule.deleted',
      ALERT_ACKNOWLEDGED: 'alert.acknowledged',
      ALERT_RESOLVED: 'alert.resolved',

      // Node management
      NODE_CREATED: 'node.created',
      NODE_UPDATED: 'node.updated',
      NODE_DELETED: 'node.deleted',

      // Configuration changes
      CONFIG_UPDATED: 'config.updated',

      // Security events
      SECURITY_ACCESS_DENIED: 'security.access.denied',
      SECURITY_SUSPICIOUS_ACTIVITY: 'security.suspicious.activity',
      SECURITY_RATE_LIMIT_EXCEEDED: 'security.rate.limit.exceeded',

      // System events
      SYSTEM_STARTUP: 'system.startup',
      SYSTEM_SHUTDOWN: 'system.shutdown',
      SYSTEM_ERROR: 'system.error'
    };

    this.severityLevels = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      CRITICAL: 'critical'
    };
  }

  /**
   * Log an audit event
   */
  async log({
    eventType,
    userId = null,
    username = null,
    ipAddress = null,
    userAgent = null,
    resource = null,
    resourceId = null,
    action = null,
    status = 'success',
    severity = 'info',
    details = null,
    metadata = {}
  }) {
    try {
      await query(`
        INSERT INTO audit_logs (
          event_type,
          user_id,
          username,
          ip_address,
          user_agent,
          resource,
          resource_id,
          action,
          status,
          severity,
          details,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      `, [
        eventType,
        userId,
        username,
        ipAddress,
        userAgent,
        resource,
        resourceId,
        action,
        status,
        severity,
        details,
        JSON.stringify(metadata)
      ]);

      // Log to console for immediate visibility
      const logLevel = severity === 'critical' || severity === 'error' ? 'error' : 'log';
      console[logLevel](`[AUDIT] ${eventType} - ${username || 'system'} - ${status}`);

    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - audit logging should never break the application
    }
  }

  /**
   * Log authentication success
   */
  async logAuthSuccess(user, req) {
    await this.log({
      eventType: this.eventTypes.AUTH_LOGIN_SUCCESS,
      userId: user.id,
      username: user.username,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      action: 'login',
      status: 'success',
      severity: this.severityLevels.INFO,
      details: `User ${user.username} logged in successfully`,
      metadata: {
        role: user.role
      }
    });
  }

  /**
   * Log authentication failure
   */
  async logAuthFailure(username, reason, req) {
    await this.log({
      eventType: this.eventTypes.AUTH_LOGIN_FAILED,
      username: username,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      action: 'login',
      status: 'failed',
      severity: this.severityLevels.WARNING,
      details: `Login attempt failed for user ${username}`,
      metadata: {
        reason: reason
      }
    });
  }

  /**
   * Log logout
   */
  async logLogout(user, req) {
    await this.log({
      eventType: this.eventTypes.AUTH_LOGOUT,
      userId: user.id,
      username: user.username,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      action: 'logout',
      status: 'success',
      severity: this.severityLevels.INFO,
      details: `User ${user.username} logged out`
    });
  }

  /**
   * Log resource creation
   */
  async logCreate(resource, resourceId, user, req, details = null) {
    await this.log({
      eventType: `${resource}.created`,
      userId: user?.id,
      username: user?.username,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      resource: resource,
      resourceId: resourceId,
      action: 'create',
      status: 'success',
      severity: this.severityLevels.INFO,
      details: details || `${resource} created with ID ${resourceId}`
    });
  }

  /**
   * Log resource update
   */
  async logUpdate(resource, resourceId, user, req, changes = null) {
    await this.log({
      eventType: `${resource}.updated`,
      userId: user?.id,
      username: user?.username,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      resource: resource,
      resourceId: resourceId,
      action: 'update',
      status: 'success',
      severity: this.severityLevels.INFO,
      details: `${resource} ${resourceId} updated`,
      metadata: changes ? { changes } : {}
    });
  }

  /**
   * Log resource deletion
   */
  async logDelete(resource, resourceId, user, req) {
    await this.log({
      eventType: `${resource}.deleted`,
      userId: user?.id,
      username: user?.username,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      resource: resource,
      resourceId: resourceId,
      action: 'delete',
      status: 'success',
      severity: this.severityLevels.WARNING,
      details: `${resource} ${resourceId} deleted`
    });
  }

  /**
   * Log access denied
   */
  async logAccessDenied(user, resource, action, req, reason = 'Insufficient permissions') {
    await this.log({
      eventType: this.eventTypes.SECURITY_ACCESS_DENIED,
      userId: user?.id,
      username: user?.username,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      resource: resource,
      action: action,
      status: 'denied',
      severity: this.severityLevels.WARNING,
      details: `Access denied to ${resource} for action ${action}`,
      metadata: {
        reason: reason
      }
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(description, req, metadata = {}) {
    await this.log({
      eventType: this.eventTypes.SECURITY_SUSPICIOUS_ACTIVITY,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      action: 'suspicious_activity',
      status: 'detected',
      severity: this.severityLevels.ERROR,
      details: description,
      metadata: metadata
    });
  }

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(req) {
    await this.log({
      eventType: this.eventTypes.SECURITY_RATE_LIMIT_EXCEEDED,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      action: 'rate_limit',
      status: 'exceeded',
      severity: this.severityLevels.WARNING,
      details: 'Rate limit exceeded',
      metadata: {
        path: req.path,
        method: req.method
      }
    });
  }

  /**
   * Log system event
   */
  async logSystemEvent(eventType, severity, details, metadata = {}) {
    await this.log({
      eventType: eventType,
      severity: severity,
      details: details,
      metadata: metadata
    });
  }

  /**
   * Get IP address from request
   */
  getIpAddress(req) {
    if (!req) return null;

    return req.ip ||
           req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           null;
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs({
    startDate = null,
    endDate = null,
    userId = null,
    username = null,
    eventType = null,
    severity = null,
    resource = null,
    status = null,
    limit = 100,
    offset = 0
  } = {}) {
    try {
      let sql = `
        SELECT *
        FROM audit_logs
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        params.push(startDate);
        sql += ` AND created_at >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        sql += ` AND created_at <= $${params.length}`;
      }

      if (userId) {
        params.push(userId);
        sql += ` AND user_id = $${params.length}`;
      }

      if (username) {
        params.push(`%${username}%`);
        sql += ` AND username ILIKE $${params.length}`;
      }

      if (eventType) {
        params.push(eventType);
        sql += ` AND event_type = $${params.length}`;
      }

      if (severity) {
        params.push(severity);
        sql += ` AND severity = $${params.length}`;
      }

      if (resource) {
        params.push(resource);
        sql += ` AND resource = $${params.length}`;
      }

      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }

      sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const result = await query(sql, params);
      return result.rows;

    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getStatistics(timeRange = '24h') {
    try {
      const intervalMap = {
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };

      const interval = intervalMap[timeRange] || '24 hours';

      const result = await query(`
        SELECT
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE severity = 'error') as error_count,
          COUNT(*) FILTER (WHERE severity = 'warning') as warning_count,
          COUNT(*) FILTER (WHERE severity = 'info') as info_count,
          COUNT(*) FILTER (WHERE status = 'failed' OR status = 'denied') as failed_count,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users,
          COUNT(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL) as unique_ips,
          COUNT(*) FILTER (WHERE event_type LIKE 'auth.login%') as login_attempts,
          COUNT(*) FILTER (WHERE event_type = 'auth.login.failed') as failed_logins
        FROM audit_logs
        WHERE created_at > NOW() - INTERVAL '${interval}'
      `);

      return result.rows[0];

    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivity(userId, timeRange = '7d') {
    try {
      const intervalMap = {
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };

      const interval = intervalMap[timeRange] || '7 days';

      const result = await query(`
        SELECT
          event_type,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM audit_logs
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '${interval}'
        GROUP BY event_type
        ORDER BY count DESC
      `, [userId]);

      return result.rows;

    } catch (error) {
      console.error('Failed to get user activity:', error);
      throw error;
    }
  }

  /**
   * Clean old audit logs
   */
  async cleanOldLogs(daysToKeep = 90) {
    try {
      const result = await query(`
        DELETE FROM audit_logs
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
        RETURNING id
      `);

      console.log(`Cleaned ${result.rowCount} audit log entries older than ${daysToKeep} days`);
      return result.rowCount;

    } catch (error) {
      console.error('Failed to clean old audit logs:', error);
      throw error;
    }
  }
}

// Singleton instance
const auditLogger = new AuditLogger();

module.exports = auditLogger;
