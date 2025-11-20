# Phase 7: Advanced Security & Audit Logging

## Overview

Phase 7 implements comprehensive security features and audit logging for the Digiskills Network Monitoring System. This includes detailed event tracking, session management, IP-based access controls, and a security dashboard for monitoring system activity.

## Features Implemented

### 1. Comprehensive Audit Logging System

**File:** `backend/src/services/audit-logger.js`

- **Event Tracking**: Logs all security-relevant events including:
  - Authentication (login success/failure, logout)
  - User management (create, update, delete)
  - Alert management (rule creation, updates, acknowledgments)
  - Node management (create, update, delete)
  - Security events (access denied, suspicious activity)
  - System events (startup, shutdown, configuration changes)

- **Event Attributes**:
  - Event type and category
  - User ID and username
  - IP address and user agent
  - Resource and resource ID
  - Action and status
  - Severity level (info, warning, error, critical)
  - Detailed description and metadata

- **Key Methods**:
  ```javascript
  // Log authentication events
  await auditLogger.logAuthSuccess(user, req)
  await auditLogger.logAuthFailure(username, reason, req)

  // Log resource changes
  await auditLogger.logCreate('alert_rule', ruleId, user, req, details)
  await auditLogger.logUpdate('node', nodeId, user, req, changes)
  await auditLogger.logDelete('alert_rule', ruleId, user, req)

  // Log security events
  await auditLogger.logAccessDenied(user, 'alert_rules', 'delete', req, reason)

  // Query audit logs
  const logs = await auditLogger.getLogs({ eventType: 'AUTH_', timeRange: '24h' })
  const stats = await auditLogger.getStatistics('7d')
  ```

### 2. Enhanced Security Middleware

**File:** `backend/src/middleware/security.js`

#### Login Lockout Protection
- Tracks failed login attempts by IP address
- **Lockout Policy**: 5 failed attempts = 15-minute lockout
- Automatically resets after successful login
- Logs lockout events to audit system

```javascript
// Usage in auth routes
app.post('/api/auth/login', checkLoginLockout, authController.login)
```

#### Session Management
- Creates session records on successful login
- Tracks session metadata:
  - IP address and user agent
  - Creation time and last activity
  - Expiration time (8 hours by default)
- Validates sessions on each request
- Automatic cleanup of expired sessions

```javascript
// Create session on login
await createSession(userId, token, req)

// Validate session (middleware)
app.use(validateSession)

// Revoke session on logout
await revokeSession(token)
```

#### Request Logging
- Enhanced logging middleware for all API requests
- Tracks:
  - Request method, path, and query parameters
  - User authentication status
  - Response status and duration
  - Performance metrics
- Automatic error detection and logging

#### Suspicious Activity Detection
- Monitors for unusual patterns:
  - High request rates from single IP
  - Multiple IPs per user account
  - Access attempts to restricted resources
- Logs suspicious activity for review

### 3. Security Controller & API

**File:** `backend/src/controllers/security.controller.js`

#### Endpoints

**Audit Logs** (Admin Only)
```
GET /api/security/audit-logs
  Query params: eventType, severity, timeRange, userId, limit, offset
  Response: Paginated list of audit log entries

GET /api/security/audit-logs/statistics
  Query params: timeRange
  Response: Aggregate statistics (total events, by type, by severity)

GET /api/security/audit-logs/users/:userId/activity
  Query params: timeRange
  Response: User-specific activity summary

GET /api/security/audit-logs/export
  Query params: format (csv|json), eventType, severity, timeRange
  Response: Downloadable audit log export
```

**User Activity** (All Users)
```
GET /api/security/my/activity
  Response: Current user's activity summary
```

**Session Management** (All Users)
```
GET /api/security/my/sessions
  Response: Current user's active sessions

POST /api/security/sessions/:sessionId/revoke
  Response: Revoke a specific session
```

**Security Dashboard** (Admin Only)
```
GET /api/security/dashboard
  Response: Security overview with key metrics
  - Total events (24h)
  - Security events count
  - Failed login attempts
  - Active sessions
  - Recent security events
```

### 4. Database Schema

**Migration:** `backend/src/config/migrate.js` - Migration 9

#### audit_logs Table
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  username VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  resource VARCHAR(100),
  resource_id VARCHAR(100),
  action VARCHAR(50),
  status VARCHAR(20) DEFAULT 'success',
  severity VARCHAR(20) DEFAULT 'info',
  details TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_username ON audit_logs(username);
```

#### user_sessions Table
```sql
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
```

### 5. Frontend Security Interface

**File:** `frontend/src/pages/Security.jsx`

#### Features

**Dashboard Tab**
- Key security metrics cards
- Recent security events feed
- At-a-glance security overview

**Audit Logs Tab**
- Comprehensive log viewer
- Advanced filtering:
  - Event type (Authentication, User Management, Alerts, Nodes, Security, System)
  - Severity (Critical, Error, Warning, Info)
  - Time range (1h, 24h, 7d, 30d, All)
- Export functionality (CSV, JSON)
- Detailed event information display
- Color-coded severity indicators

**My Sessions Tab**
- View all active sessions
- Session details:
  - IP address
  - User agent (browser/device)
  - Creation time
  - Last activity
  - Expiration time
- Revoke individual sessions
- Current session indicator

**My Activity Tab**
- Personal activity summary
- Activity statistics
- Recent actions feed

#### Navigation
- Added "Security" menu item with Shield icon
- Accessible from main navigation sidebar
- Available to all authenticated users (dashboard restricted to admins)

## Configuration

### Environment Variables

Add to `.env`:

```env
# Session Configuration
SESSION_DURATION=8h              # Session expiration time
SESSION_CLEANUP_INTERVAL=1h      # How often to clean expired sessions

# Security Configuration
MAX_FAILED_LOGINS=5             # Max failed attempts before lockout
LOCKOUT_DURATION=15             # Lockout duration in minutes
SUSPICIOUS_REQUEST_THRESHOLD=100 # Requests per minute threshold
```

## Usage Examples

### 1. View Security Dashboard

Navigate to **Security** → **Dashboard** tab

View real-time security metrics and recent events.

### 2. Search Audit Logs

Navigate to **Security** → **Audit Logs** tab

1. Select filters (event type, severity, time range)
2. View filtered results in table
3. Export to CSV or JSON for analysis

### 3. Manage Sessions

Navigate to **Security** → **My Sessions** tab

1. View all active sessions
2. Identify unfamiliar sessions
3. Click "Revoke" to terminate suspicious sessions

### 4. Check Personal Activity

Navigate to **Security** → **My Activity** tab

Review your recent actions and login history.

## Security Best Practices

### 1. Regular Audit Log Review
- Check audit logs daily for suspicious activity
- Monitor failed login attempts
- Review access denied events
- Export logs regularly for archival

### 2. Session Management
- Regularly review active sessions
- Revoke unknown or old sessions
- Change password if suspicious activity detected

### 3. Alert Configuration
- Set up alerts for critical security events
- Monitor repeated failed login attempts
- Track access to sensitive resources

### 4. Data Retention
- Archive old audit logs periodically
- Keep audit logs for compliance requirements
- Regular cleanup of expired sessions

## Integration Points

### Authentication Flow
```javascript
// Login (auth.controller.js)
1. Check IP lockout status
2. Validate credentials
3. Create user session
4. Log successful authentication
5. Reset failed attempt counter

// Login failure
1. Record failed attempt
2. Log authentication failure
3. Apply lockout if threshold reached
```

### Protected Resources
```javascript
// Any protected endpoint
app.get('/api/resource',
  authenticateJWT,      // Verify token
  validateSession,      // Validate session
  requireRole('admin'), // Check authorization
  controller.method     // Execute action
)

// Access denied automatically logged
```

### Logout Flow
```javascript
// Logout (auth.controller.js)
1. Revoke current session
2. Log logout event
3. Clear authentication
```

## Performance Considerations

### Database Indexes
- All frequently queried fields are indexed
- Composite indexes on common filter combinations
- Regular index maintenance recommended

### Query Optimization
- Time-range filters to limit result sets
- Pagination for large result sets
- Efficient JSON queries for metadata

### Cleanup Jobs
- Automatic expired session cleanup
- Old audit log archival (recommended)
- Regular VACUUM on audit_logs table

## Testing

### Test Login Lockout
```bash
# Make 5 failed login attempts
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"wrong"}'

# 6th attempt should be blocked
# Check audit logs for lockout events
```

### Test Session Management
```bash
# Login and get token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.token')

# View sessions
curl http://localhost:3000/api/security/my/sessions \
  -H "Authorization: Bearer $TOKEN"
```

### Test Audit Logs
```bash
# View recent audit logs (admin only)
curl http://localhost:3000/api/security/audit-logs?timeRange=24h \
  -H "Authorization: Bearer $TOKEN"

# Export audit logs
curl http://localhost:3000/api/security/audit-logs/export?format=csv \
  -H "Authorization: Bearer $TOKEN" \
  -o audit-logs.csv
```

## Troubleshooting

### Issue: Too many failed login attempts
**Solution**: Wait for lockout duration (15 minutes) or contact admin to clear lockout

### Issue: Session expired too quickly
**Solution**: Adjust SESSION_DURATION in .env file

### Issue: Audit logs growing too large
**Solution**: Implement archival process or increase cleanup frequency

### Issue: Missing audit log entries
**Solution**:
- Check database connection
- Verify audit-logger initialization
- Check for errors in application logs

## File Structure

```
backend/
├── src/
│   ├── services/
│   │   └── audit-logger.js          # Audit logging service
│   ├── middleware/
│   │   └── security.js               # Security middleware
│   ├── controllers/
│   │   ├── security.controller.js    # Security API controller
│   │   └── auth.controller.js        # Updated with audit logging
│   └── config/
│       └── migrate.js                # Updated with Migration 9

frontend/
├── src/
│   ├── pages/
│   │   └── Security.jsx              # Security dashboard page
│   ├── components/
│   │   └── common/
│   │       └── Layout.jsx            # Updated with Security link
│   └── App.jsx                       # Updated with Security route
```

## Next Steps

### Recommended Enhancements
1. **Email Alerts**: Send email notifications for critical security events
2. **2FA Integration**: Add two-factor authentication support
3. **IP Whitelisting**: Implement IP-based access restrictions
4. **Compliance Reports**: Generate automated compliance reports
5. **Real-time Monitoring**: WebSocket-based real-time security feed
6. **Advanced Analytics**: Machine learning for anomaly detection

### Phase 8 Preview
Phase 8 will focus on production deployment:
- Docker containerization
- Load balancing and high availability
- Automated backups and disaster recovery
- Performance optimization
- Production monitoring and logging

## Support

For issues or questions:
1. Check application logs: `backend/logs/`
2. Review audit logs in Security dashboard
3. Consult troubleshooting section above
4. Contact IT support team

## Compliance Notes

This audit logging system helps meet compliance requirements for:
- **GDPR**: User activity tracking and data access logs
- **SOC 2**: Security event monitoring and access controls
- **HIPAA**: Audit trails for healthcare data access (if applicable)
- **PCI DSS**: Access control and monitoring requirements

Ensure regular review and archival of audit logs per your organization's compliance policies.
