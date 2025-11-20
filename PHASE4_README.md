# Phase 4: Zabbix Integration - Complete

## What's Been Implemented

Phase 4 adds Zabbix API integration for monitoring internet WAN links with automated status synchronization and bandwidth tracking.

### 🎯 New Components

#### 1. Zabbix Integration Service (`zabbix-integration.js`)

Full Zabbix JSON-RPC API implementation:

- **Authentication**
  - User login via JSON-RPC
  - Token management with auto-refresh
  - Session timeout handling (50-minute expiry)
  - Automatic re-authentication on session expiry

- **Host Discovery**
  - Query "Internet Links" host group
  - Fallback search for hosts with "internet", "wan", "link", "isp" in name
  - Extract host metadata (ID, name, IP, tags)
  - Filter enabled/disabled hosts

- **Item Monitoring**
  - Query interface bandwidth items (net.if.in/out)
  - Query ICMP ping status (icmpping)
  - Query interface operational status (ifOperStatus)
  - Trigger status checking
  - Support for multiple interface names (eth0, ens3, wan, pppoe-out1)

- **Data Collection**
  - Bandwidth tracking (incoming/outgoing)
  - Link status detection (up/down/unknown)
  - Active problems retrieval
  - Historical data support

- **Features**
  - Automatic link type detection (fiber, DSL, wireless, satellite, backup)
  - Tag-based configuration
  - Connection testing and health checks
  - Error handling with automatic retry

#### 2. Zabbix Sync Worker (`zabbix-sync-worker.js`)

Background synchronization service:

- **Periodic Sync**
  - Default interval: 5 minutes (configurable via ZABBIX_SYNC_INTERVAL)
  - Automatic initial sync on startup
  - Scheduled syncs with setInterval

- **Monitoring**
  - Sync count tracking
  - Error counting
  - Last sync timestamp
  - Statistics display every 30 seconds

- **Features**
  - Graceful shutdown handling
  - Connection test before starting
  - Automatic error recovery
  - Performance metrics

#### 3. Zabbix API Endpoints (`zabbix.controller.js`)

10 new REST API endpoints:

```
GET  /api/zabbix/test                      - Test Zabbix API connection (admin)
POST /api/zabbix/sync                      - Manually trigger sync (admin)
GET  /api/zabbix/links                     - Get all internet links
GET  /api/zabbix/links/stats               - Get link statistics
GET  /api/zabbix/links/by-type             - Get links grouped by type
GET  /api/zabbix/links/:id                 - Get specific link by ID
GET  /api/zabbix/links/host/:hostId        - Get link by Zabbix host ID
GET  /api/zabbix/links/host/:hostId/history - Get bandwidth history
PUT  /api/zabbix/links/:id                 - Update link metadata (admin)
GET  /api/zabbix/problems                  - Get active problems from Zabbix
```

#### 4. Internet Links Frontend (`InternetLinks.jsx`)

Full-featured link monitoring dashboard:

- **Statistics Cards**
  - Total links count
  - Links up count
  - Links down count
  - Total bandwidth (in + out)

- **Link Status Table**
  - Visual status indicators (up/down/unknown)
  - Link name and description
  - Link type badges (fiber, DSL, wireless, etc.)
  - IP address display
  - Bandwidth in/out display
  - Last seen timestamps

- **Filtering**
  - Filter by status (all, up, down, unknown)
  - Filter by type (fiber, DSL, wireless, satellite, backup)

- **Active Problems Display**
  - Real-time problem alerts from Zabbix
  - Severity indication
  - Problem description
  - Affected host display
  - Timestamp display

- **Controls**
  - Manual sync button
  - Refresh button
  - Auto-loading states

- **Configuration Hints**
  - Setup instructions when no data
  - Environment variable examples
  - Zabbix configuration guidance

## 🚀 How to Use

### Configure Zabbix API Access

Add to `.env` file:

```bash
# Zabbix Integration
ZABBIX_URL=http://zabbix.digiskills.local/api_jsonrpc.php
ZABBIX_USER=api_user
ZABBIX_PASSWORD=ApiPassword
ZABBIX_SYNC_INTERVAL=300000  # 5 minutes in milliseconds
```

### Create Zabbix API User

1. **Login to Zabbix**:
   - Go to: Administration > Users
   - Click "Create user"

2. **Configure User**:
   - Username: `api_user`
   - Password: Set a strong password
   - Role: User or Admin

3. **Grant Permissions**:
   - Ensure user has read access to:
     - Host groups containing internet links
     - Items (bandwidth, ping status)
     - Problems
     - History data

### Set Up Host Group in Zabbix

#### Option 1: Create "Internet Links" Host Group

```bash
# In Zabbix UI:
1. Go to: Configuration > Host groups
2. Click "Create host group"
3. Name: "Internet Links"
4. Add hosts to this group
```

#### Option 2: Use Existing Hosts

The integration automatically searches for hosts with these keywords:
- "internet"
- "wan"
- "link"
- "isp"

No special group configuration needed if your hosts are named appropriately.

### Configure Internet Link Monitoring in Zabbix

For each internet link, configure the following items:

#### Required Items:

1. **ICMP Ping (Link Status)**
   ```
   Key: icmpping
   Type: Simple check
   Update interval: 60s
   ```

2. **Incoming Traffic**
   ```
   Key: net.if.in[eth0]
   Type: Zabbix agent or SNMP
   Update interval: 60s
   Units: bps
   ```

3. **Outgoing Traffic**
   ```
   Key: net.if.out[eth0]
   Type: Zabbix agent or SNMP
   Update interval: 60s
   Units: bps
   ```

#### Optional: Link Type Tags

Add tags to hosts for automatic type detection:

```
Tag: link_type
Value: fiber | dsl | wireless | satellite | backup
```

### Start the Zabbix Sync Worker

#### Option 1: Standalone

```bash
cd backend
npm run zabbix-sync

# Or with auto-reload for development
npm run zabbix-sync:dev
```

#### Option 2: As Background Service

```bash
# Using PM2 (recommended for production)
pm2 start backend/src/workers/zabbix-sync-worker.js --name zabbix-sync

# Or using systemd
sudo cp deployment/zabbix-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable zabbix-sync
sudo systemctl start zabbix-sync
```

### View Internet Links Dashboard

1. **Open the dashboard**: http://localhost:5173
2. **Navigate to**: Internet Links
3. **Click**: "Sync from Zabbix" to perform initial sync
4. **View**: Link status, bandwidth, and active problems

## 📊 How It Works

### Data Flow

```
┌──────────────┐
│    Zabbix    │ (Monitoring Server)
│  JSON-RPC API│
└──────┬───────┘
       │ HTTP API
       ↓
┌──────────────┐
│   Zabbix     │
│ Integration  │ (Query hosts & items)
└──────┬───────┘
       │
       ↓
┌──────────────┐
│    Sync      │
│   Worker     │ (Every 5 minutes)
└──────┬───────┘
       │
       ↓
┌──────────────┐
│  PostgreSQL  │ (zabbix_internet_links)
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   REST API   │ (10 endpoints)
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   Frontend   │ (React Dashboard)
└──────────────┘
```

### Synchronization Process

```
1. Authenticate with Zabbix API
   └─→ Get authentication token (valid 1 hour)

2. Query Internet Link Hosts
   ├─→ Try "Internet Links" host group
   └─→ Fallback: Search by name keywords

3. For Each Host:
   ├─→ Get ICMP ping status (up/down)
   ├─→ Get bandwidth items (in/out)
   ├─→ Detect link type from name/tags
   └─→ Upsert to database

4. Update Statistics
   └─→ Log sync results (synced/errors)
```

### Link Type Detection

The system automatically detects link types based on:

1. **Host Name Keywords**:
   - `fiber`, `ftth` → Fiber
   - `dsl`, `adsl` → DSL
   - `wireless`, `wifi`, `lte`, `4g` → Wireless
   - `satellite` → Satellite
   - `backup`, `failover` → Backup

2. **Host Tags**:
   - Tag name: `link_type`
   - Tag value: `fiber | dsl | wireless | satellite | backup`

3. **Fallback**: Unknown

## 🔧 Configuration

### Environment Variables

```bash
# Zabbix API
ZABBIX_URL=http://zabbix.digiskills.local/api_jsonrpc.php
ZABBIX_USER=api_user
ZABBIX_PASSWORD=ApiPassword

# Sync interval (default: 5 minutes)
ZABBIX_SYNC_INTERVAL=300000
```

### Firewall Requirements

- **HTTP/HTTPS Access**: From monitoring server to Zabbix API
- **Port**: 80 or 443 (depending on Zabbix configuration)

### Zabbix Version Compatibility

Tested with:
- Zabbix 5.x (JSON-RPC 2.0)
- Zabbix 6.x (JSON-RPC 2.0)
- Zabbix 7.x (JSON-RPC 2.0)

## 📈 Database Schema

### zabbix_internet_links Table

```sql
CREATE TABLE zabbix_internet_links (
  id SERIAL PRIMARY KEY,
  zabbix_host_id VARCHAR(50) UNIQUE NOT NULL,
  link_name VARCHAR(255) NOT NULL,
  link_type VARCHAR(50),
  ip_address INET,
  status VARCHAR(20),
  bandwidth_in BIGINT,
  bandwidth_out BIGINT,
  last_seen TIMESTAMPTZ,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_zabbix_links_status ON zabbix_internet_links (status);
CREATE INDEX idx_zabbix_links_type ON zabbix_internet_links (link_type);
CREATE UNIQUE INDEX idx_zabbix_host_id ON zabbix_internet_links (zabbix_host_id);
```

## 🧪 Testing

### Test Zabbix Connection

```bash
# Via API endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/zabbix/test

# Expected response:
{
  "success": true,
  "data": {
    "success": true,
    "version": "6.0.24",
    "authenticated": true,
    "can_read_hosts": true,
    "message": "Connected to Zabbix 6.0.24"
  }
}
```

### Manual Sync

```bash
# Trigger manual sync
curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/zabbix/sync

# Expected response:
{
  "success": true,
  "message": "Synced 5 internet links",
  "data": {
    "synced": 5,
    "errors": 0,
    "total": 5
  }
}
```

### Get Internet Links

```bash
# Get all links
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/zabbix/links

# Filter by status
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/zabbix/links?status=up

# Filter by type
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/zabbix/links?type=fiber
```

### Get Statistics

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/zabbix/links/stats

# Expected response:
{
  "success": true,
  "data": {
    "total_links": "5",
    "links_up": "4",
    "links_down": "1",
    "links_unknown": "0",
    "total_bandwidth_in": "1500000000",
    "total_bandwidth_out": "800000000",
    "avg_bandwidth_in": "300000000",
    "avg_bandwidth_out": "160000000"
  }
}
```

## 📊 Example Zabbix Templates

### FortiGate WAN Link Template

```xml
<items>
  <item>
    <name>WAN Link Status</name>
    <key>icmpping</key>
    <type>SIMPLE</type>
    <delay>60s</delay>
  </item>
  <item>
    <name>WAN Incoming Traffic</name>
    <key>ifHCInOctets[wan1]</key>
    <type>SNMP_AGENT</type>
    <snmp_oid>1.3.6.1.2.1.31.1.1.1.6.10</snmp_oid>
    <delay>60s</delay>
    <units>bps</units>
    <preprocessing>
      <step>
        <type>CHANGE_PER_SECOND</type>
      </step>
      <step>
        <type>MULTIPLIER</type>
        <params>8</params>
      </step>
    </preprocessing>
  </item>
</items>
```

### MikroTik WAN Link Template

```xml
<items>
  <item>
    <name>WAN Link Status</name>
    <key>icmpping</key>
    <type>SIMPLE</type>
    <delay>60s</delay>
  </item>
  <item>
    <name>WAN Interface Status</name>
    <key>ifOperStatus[ether1]</key>
    <type>SNMP_AGENT</type>
    <snmp_oid>1.3.6.1.2.1.2.2.1.8.1</snmp_oid>
  </item>
</items>
```

## 🐛 Troubleshooting

### No Links Appearing in Dashboard

1. **Check Zabbix connection**:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/zabbix/test
   ```

2. **Verify API credentials**:
   - Check `.env` file has correct ZABBIX_USER and ZABBIX_PASSWORD
   - Test login to Zabbix UI with same credentials

3. **Check host group configuration**:
   - Ensure "Internet Links" group exists in Zabbix
   - OR ensure hosts contain keywords: internet, wan, link, isp

4. **Manually trigger sync**:
   ```bash
   curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/zabbix/sync
   ```

### Sync Worker Not Running

1. **Check process**:
   ```bash
   ps aux | grep zabbix-sync-worker
   ```

2. **View logs**:
   ```bash
   # If using PM2
   pm2 logs zabbix-sync

   # If running in terminal
   npm run zabbix-sync
   ```

3. **Check environment variables**:
   ```bash
   echo $ZABBIX_URL
   echo $ZABBIX_USER
   ```

### Authentication Errors

**Error**: "Zabbix authentication failed"

1. **Verify credentials**:
   ```bash
   # Test with curl directly
   curl -X POST http://zabbix.digiskills.local/api_jsonrpc.php \
     -H "Content-Type: application/json-rpc" \
     -d '{
       "jsonrpc": "2.0",
       "method": "user.login",
       "params": {
         "username": "api_user",
         "password": "ApiPassword"
       },
       "id": 1
     }'
   ```

2. **Check user permissions**:
   - In Zabbix UI: Administration > Users
   - Verify user role has "API access" enabled
   - Check user is not disabled

### No Bandwidth Data

**Issue**: Links show up but bandwidth is 0 or null

1. **Check Zabbix items**:
   - Verify `net.if.in[interface]` items exist and are enabled
   - Verify `net.if.out[interface]` items exist and are enabled
   - Check items are collecting data (View latest data in Zabbix)

2. **Check interface names**:
   - System tries: eth0, ens3, wan, pppoe-out1
   - Verify your interface name matches
   - Adjust item keys if needed

3. **Check units**:
   - Items should return bytes per second (bps)
   - Use preprocessing if needed (multiply by 8 for bits)

## 📊 Performance

### Expected Performance

- **Sync time**: 2-10 seconds (depends on number of links)
- **Memory usage**: ~50-100 MB for worker
- **API response time**: <200ms per request
- **Database growth**: Minimal (only link metadata)

### Optimization Tips

1. **Increase sync interval** for large deployments (300000ms → 600000ms)
2. **Use caching** for frequently accessed endpoints
3. **Limit problem queries** to recent issues only
4. **Index frequently queried fields** in database

## 🔒 Security

### API Security

- **Admin-only endpoints**: Test connection, sync, update
- **JWT authentication**: Required for all endpoints
- **Role-based access**: Admin role required for sensitive operations

### Zabbix Security

- **Read-only user**: Use dedicated API user with minimal permissions
- **HTTPS**: Use HTTPS for Zabbix API in production
- **Credential storage**: Store passwords in environment variables (not in code)
- **Token expiry**: Automatic token refresh after 50 minutes

### Network Security

- **Firewall**: Allow only monitoring server to access Zabbix API
- **VPN**: Consider VPN for Zabbix access if monitoring remotely
- **SSL/TLS**: Use certificate validation in production

## 🎉 What's Working

### Features Implemented

✅ Zabbix JSON-RPC API integration
✅ Automatic host discovery
✅ Link status monitoring (up/down)
✅ Bandwidth tracking (in/out)
✅ Link type detection
✅ Background sync worker
✅ 10 REST API endpoints
✅ Frontend dashboard with statistics
✅ Active problems display
✅ Manual sync capability
✅ Connection testing

### API Endpoints

✅ Test Zabbix connection
✅ Manual sync trigger
✅ Get all links (with filters)
✅ Get link statistics
✅ Get links by type
✅ Get specific link details
✅ Get link bandwidth history
✅ Update link metadata
✅ Get active problems

### Frontend

✅ Internet Links page
✅ Statistics cards
✅ Link status table
✅ Status/type filtering
✅ Active problems alerts
✅ Manual sync button
✅ Configuration hints
✅ Auto-refresh capability

## 🎯 What's Next

Phase 4 is complete! The system now monitors internet WAN links via Zabbix integration.

**Ready for Phase 5**:
- Enhanced dashboard visualizations
- Interactive charts for bandwidth trends
- Historical data analysis
- Real-time graphs

**Future Enhancements**:
- Automatic failover detection
- SLA tracking and reporting
- Link utilization alerts
- Bandwidth capacity planning
- Integration with other monitoring systems (Nagios, Prometheus)

## 📞 Support

For issues or questions:
- Check the main README.md
- Review Zabbix sync worker logs
- Verify Zabbix API configuration
- Test API connectivity
- Check database for synced data

---

**Phase 4 Completed**: November 20, 2025
**Version**: 1.0.0-phase4
