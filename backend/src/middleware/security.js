const auditLogger = require('../services/audit-logger');
const { query } = require('../config/database');

/**
 * Enhanced Security Middleware
 *
 * Provides additional security layers including IP tracking,
 * session management, and suspicious activity detection.
 */

// Track failed login attempts by IP
const failedLoginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Check if IP is locked out due to failed login attempts
 */
function checkLoginLockout(req, res, next) {
  const ip = auditLogger.getIpAddress(req);

  if (!ip) {
    return next();
  }

  const attempts = failedLoginAttempts.get(ip);

  if (attempts && attempts.count >= MAX_FAILED_ATTEMPTS) {
    const timeSinceLast = Date.now() - attempts.lastAttempt;

    if (timeSinceLast < LOCKOUT_DURATION) {
      const remainingTime = Math.ceil((LOCKOUT_DURATION - timeSinceLast) / 1000 / 60);

      auditLogger.logSuspiciousActivity(
        `IP ${ip} is locked out due to multiple failed login attempts`,
        req,
        { attempts: attempts.count }
      );

      return res.status(429).json({
        error: 'Too many failed login attempts',
        message: `Account locked. Please try again in ${remainingTime} minutes.`,
        retryAfter: remainingTime
      });
    } else {
      // Lockout expired, reset
      failedLoginAttempts.delete(ip);
    }
  }

  next();
}

/**
 * Record failed login attempt
 */
function recordFailedLogin(ip) {
  if (!ip) return;

  const attempts = failedLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 };

  attempts.count++;
  attempts.lastAttempt = Date.now();

  failedLoginAttempts.set(ip, attempts);

  if (attempts.count >= MAX_FAILED_ATTEMPTS) {
    console.log(`⚠️  IP ${ip} locked out after ${attempts.count} failed attempts`);
  }
}

/**
 * Reset failed login attempts on successful login
 */
function resetFailedLogins(ip) {
  if (!ip) return;
  failedLoginAttempts.delete(ip);
}

/**
 * Track user sessions
 */
async function createSession(userId, token, req) {
  try {
    const ip = auditLogger.getIpAddress(req);
    const userAgent = req.headers['user-agent'];

    await query(`
      INSERT INTO user_sessions (
        user_id,
        token_hash,
        ip_address,
        user_agent,
        created_at,
        last_activity,
        expires_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW() + INTERVAL '8 hours')
    `, [
      userId,
      hashToken(token),
      ip,
      userAgent
    ]);

  } catch (error) {
    console.error('Failed to create session:', error);
    // Don't throw - session tracking should not break authentication
  }
}

/**
 * Update session activity
 */
async function updateSessionActivity(userId, token) {
  try {
    await query(`
      UPDATE user_sessions
      SET last_activity = NOW()
      WHERE user_id = $1
        AND token_hash = $2
        AND expires_at > NOW()
    `, [userId, hashToken(token)]);

  } catch (error) {
    console.error('Failed to update session activity:', error);
  }
}

/**
 * Revoke session
 */
async function revokeSession(userId, token) {
  try {
    await query(`
      UPDATE user_sessions
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND token_hash = $2
    `, [userId, hashToken(token)]);

  } catch (error) {
    console.error('Failed to revoke session:', error);
  }
}

/**
 * Get active sessions for a user
 */
async function getActiveSessions(userId) {
  try {
    const result = await query(`
      SELECT
        id,
        ip_address,
        user_agent,
        created_at,
        last_activity,
        expires_at
      FROM user_sessions
      WHERE user_id = $1
        AND expires_at > NOW()
        AND revoked_at IS NULL
      ORDER BY last_activity DESC
    `, [userId]);

    return result.rows;

  } catch (error) {
    console.error('Failed to get active sessions:', error);
    return [];
  }
}

/**
 * Clean expired sessions
 */
async function cleanExpiredSessions() {
  try {
    const result = await query(`
      DELETE FROM user_sessions
      WHERE expires_at < NOW()
        OR revoked_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `);

    if (result.rowCount > 0) {
      console.log(`Cleaned ${result.rowCount} expired sessions`);
    }

    return result.rowCount;

  } catch (error) {
    console.error('Failed to clean expired sessions:', error);
    return 0;
  }
}

/**
 * Hash token for storage
 */
function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Detect suspicious activity patterns
 */
async function detectSuspiciousActivity(req) {
  const ip = auditLogger.getIpAddress(req);

  if (!ip) return;

  try {
    // Check for rapid requests from same IP
    const recentLogs = await query(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE ip_address = $1
        AND created_at > NOW() - INTERVAL '1 minute'
    `, [ip]);

    if (recentLogs.rows[0].count > 100) {
      await auditLogger.logSuspiciousActivity(
        `Suspicious activity: High request rate from IP ${ip}`,
        req,
        { requestCount: recentLogs.rows[0].count }
      );
    }

    // Check for failed logins from multiple IPs for same user
    if (req.body && req.body.username) {
      const failedLogins = await query(`
        SELECT COUNT(DISTINCT ip_address) as unique_ips
        FROM audit_logs
        WHERE event_type = 'auth.login.failed'
          AND username = $1
          AND created_at > NOW() - INTERVAL '10 minutes'
      `, [req.body.username]);

      if (failedLogins.rows[0].unique_ips > 3) {
        await auditLogger.logSuspiciousActivity(
          `Suspicious activity: Multiple IPs attempting to login as ${req.body.username}`,
          req,
          { uniqueIps: failedLogins.rows[0].unique_ips }
        );
      }
    }

  } catch (error) {
    console.error('Error detecting suspicious activity:', error);
  }
}

/**
 * Middleware to log all requests
 */
function requestLogger(req, res, next) {
  // Skip logging for health checks and static files
  if (req.path === '/health' || req.path.startsWith('/static')) {
    return next();
  }

  // Store start time
  req.startTime = Date.now();

  // Log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    // Only log if it's an API call
    if (req.path.startsWith('/api')) {
      // Log slow requests
      if (duration > 1000) {
        console.log(`⚠️  Slow request: ${req.method} ${req.path} - ${duration}ms`);
      }

      // Log errors
      if (res.statusCode >= 400) {
        console.log(`❌ Error: ${req.method} ${req.path} - ${res.statusCode}`);
      }
    }
  });

  next();
}

/**
 * Middleware to validate session
 */
async function validateSession(req, res, next) {
  // Skip if no user (not authenticated)
  if (!req.user) {
    return next();
  }

  try {
    // Check if session exists and is valid
    const result = await query(`
      SELECT id, expires_at, revoked_at
      FROM user_sessions
      WHERE user_id = $1
        AND token_hash = $2
    `, [req.user.id, hashToken(req.headers.authorization?.split(' ')[1])]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Session not found',
        message: 'Your session is invalid. Please log in again.'
      });
    }

    const session = result.rows[0];

    // Check if session is revoked
    if (session.revoked_at) {
      return res.status(401).json({
        error: 'Session revoked',
        message: 'Your session has been revoked. Please log in again.'
      });
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({
        error: 'Session expired',
        message: 'Your session has expired. Please log in again.'
      });
    }

    // Update session activity
    await updateSessionActivity(req.user.id, req.headers.authorization?.split(' ')[1]);

    next();

  } catch (error) {
    console.error('Session validation error:', error);
    next(); // Continue even if session validation fails
  }
}

// Schedule periodic cleanup
setInterval(cleanExpiredSessions, 60 * 60 * 1000); // Every hour

module.exports = {
  checkLoginLockout,
  recordFailedLogin,
  resetFailedLogins,
  createSession,
  updateSessionActivity,
  revokeSession,
  getActiveSessions,
  cleanExpiredSessions,
  detectSuspiciousActivity,
  requestLogger,
  validateSession,
  hashToken
};
