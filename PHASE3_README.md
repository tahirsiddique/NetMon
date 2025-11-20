# Phase 3: Internet Usage Tracking - Complete

## What's Been Implemented

Phase 3 adds comprehensive per-user internet bandwidth monitoring with NetFlow/sFlow integration and Active Directory username resolution.

### 🎯 New Components

#### 1. NetFlow Collector (`netflow-collector.js`)

Full NetFlow v5 and v9 protocol implementation:

- **NetFlow v5 Support**
  - Standard Cisco NetFlow format
  - Flow record parsing (48-byte records)
  - Source/destination IP, ports, protocols
  - Byte and packet counters

- **NetFlow v9 Support**
  - Template-based flexible format
  - Dynamic field definitions
  - Template caching
  - Data FlowSet processing

- **Features**
  - UDP listener on configurable port (default: 2055)
  - Real-time flow processing
  - Flow aggregation and caching
  - Internal/external IP detection
  - Protocol mapping (TCP, UDP, ICMP, etc.)
  - Automatic cache cleanup

#### 2. Username Resolver (`username-resolver.js`)

Multi-method username resolution:

- **Active Directory LDAP**
  - Query computer objects by IP
  - Extract sAMAccountName
  - Computer account handling

- **DNS Reverse Lookup**
  - PTR record queries
  - Hostname to username extraction
  - Pattern matching (DESKTOP-USER, PC-USER, etc.)

- **Database Lookup**
  - Historical username data
  - Previous flow records
  - 7-day lookback

- **Caching**
  - 1-hour cache TTL
  - Username and hostname caches
  - Automatic expiration

#### 3. Internet Usage Service (`internet-usage-service.js`)

Comprehensive usage tracking and analytics:

- **Data Aggregation**
  - Flow buffering (1-minute intervals)
  - Automatic flush to database
  - Duplicate flow handling

- **Analytics Functions**
  - Top users by bandwidth
  - Usage by protocol
  - Top destinations
  - Time-series data
  - Overall statistics

- **Query Capabilities**
  - Time range support (today, week, month, etc.)
  - User search
  - Protocol breakdown
  - Session counting

- **Data Export**
  - CSV export with custom ranges
  - Per-user export filtering
  - 10,000 record limit

#### 4. NetFlow Worker (`netflow-worker.js`)

Standalone NetFlow collector service:

- **Features**
  - UDP server on port 2055
  - Real-time flow processing
  - Statistics display (every 30 seconds)
  - Graceful shutdown
  - Buffer flush on exit

- **Monitoring**
  - Packets received counter
  - Flows processed counter
  - Cache size tracking
  - Error counting

#### 5. Internet Usage API (`internet-usage.controller.js`)

10 new REST API endpoints:

```
GET  /api/internet-usage/top-users          - Top bandwidth users
GET  /api/internet-usage/user/:username     - Specific user usage
GET  /api/internet-usage/protocols          - Usage by protocol
GET  /api/internet-usage/time-series        - Time-series for charts
GET  /api/internet-usage/destinations       - Top accessed sites/IPs
GET  /api/internet-usage/stats              - Overall statistics
GET  /api/internet-usage/search             - Search users
GET  /api/internet-usage/export             - Export to CSV
GET  /api/internet-usage/resolver/stats     - Resolver cache stats
POST /api/internet-usage/resolver/clear     - Clear resolver cache (admin)
```

#### 6. Frontend Dashboard (`InternetUsage.jsx`)

Full-featured usage tracking UI:

- **Statistics Cards**
  - Total bandwidth
  - Unique users
  - Known users
  - Total flows

- **Top Users Table**
  - Ranking display
  - Username and hostname
  - Download/upload/total bandwidth
  - IP address display

- **Protocol Distribution**
  - Visual progress bars
  - Percentage breakdown
  - Unique IP counts

- **User Search**
  - Real-time search
  - Username/hostname matching
  - Last seen timestamps

- **Controls**
  - Time range selector (today, week, month, etc.)
  - Refresh button
  - CSV export

## 🚀 How to Use

### Start the NetFlow Collector

#### Option 1: Standalone

```bash
# Start NetFlow collector
cd backend
npm run netflow

# Or with auto-reload for development
npm run netflow:dev
```

#### Option 2: With Full System

```bash
# Start everything (API + Monitoring Worker + NetFlow)
./start-monitoring.sh &
cd backend && npm run netflow
```

### Configure Your Firewall

Configure your FortiGate firewall to export NetFlow:

```bash
# SSH into FortiGate
config system netflow
    set collector-ip <YOUR_MONITORING_SERVER_IP>
    set collector-port 2055
    set source-ip <FORTIGATE_INTERNAL_IP>
end

# Verify configuration
show system netflow
```

For pfSense:

```
1. Go to System > Advanced > Miscellaneous
2. Enable NetFlow/sFlow
3. Set collector IP: <YOUR_MONITORING_SERVER_IP>
4. Set collector port: 2055
5. Select NetFlow version: v5 or v9
```

### View Usage Data

1. **Open the dashboard**: http://localhost:5173
2. **Navigate to**: Internet Usage
3. **Select time range**: Today, This Week, This Month, etc.
4. **View statistics**: Top users, protocol distribution
5. **Search users**: Find specific users or hostnames
6. **Export data**: Download CSV reports

## 📊 How It Works

### Data Flow

```
┌──────────────┐
│   Firewall   │ (FortiGate/pfSense)
│  NetFlow v5/9│
└──────┬───────┘
       │ UDP:2055
       ↓
┌──────────────┐
│   NetFlow    │
│  Collector   │ (Process packets)
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   Username   │
│   Resolver   │ (LDAP/DNS/Database)
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   Internet   │
│Usage Service │ (Aggregate & Store)
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ TimescaleDB  │ (internet_usage table)
└──────────────┘
```

### Username Resolution Flow

```
IP Address
    │
    ├─→ Check Cache → Found? → Return Username
    │
    ├─→ Query LDAP (Active Directory)
    │   └─→ Find computer object
    │       └─→ Extract sAMAccountName
    │
    ├─→ Query Database (Previous Records)
    │   └─→ Find recent username
    │
    ├─→ DNS Reverse Lookup
    │   └─→ Get hostname
    │       └─→ Extract username from pattern
    │
    └─→ Fallback → Use IP or Hostname
```

### Data Aggregation

- **Buffer**: 60-second aggregation window
- **Storage**: Automatic flush to database
- **Deduplication**: Flows merged by IP + destination + protocol
- **Bytes Tracking**: Separate sent/received counters

## 🔧 Configuration

### Environment Variables

Add to `.env`:

```bash
# NetFlow Collector
NETFLOW_PORT=2055

# Active Directory (for username resolution)
AD_LDAP_URL=ldap://dc.digiskills.local:389
AD_DOMAIN=digiskills.local
AD_BASE_DN=DC=digiskills,DC=local
```

### Firewall Configuration

#### FortiGate
```
config system netflow
    set collector-ip 192.168.1.100
    set collector-port 2055
    set source-ip 192.168.1.1
    set active-flow-timeout 1
    set inactive-flow-timeout 15
end
```

#### pfSense
- Navigate to: System > Advanced > Miscellaneous
- Enable NetFlow: ✓
- NetFlow Version: v5 or v9
- Collector: 192.168.1.100:2055

### Network Requirements

- **Firewall Rules**: Allow UDP 2055 from firewall to monitoring server
- **DNS**: Ensure reverse DNS is configured for IP-to-hostname resolution
- **LDAP**: Port 389 (or 636 for LDAPS) from monitoring server to DC

## 📈 Data Schema

### internet_usage Table

```sql
CREATE TABLE internet_usage (
  time TIMESTAMPTZ NOT NULL,
  username VARCHAR(100),
  hostname VARCHAR(255),
  ip_address INET,
  bytes_sent BIGINT,
  bytes_received BIGINT,
  protocol VARCHAR(20),
  destination VARCHAR(255),
  CONSTRAINT usage_pkey PRIMARY KEY (time, ip_address)
);
```

### Indexes

```sql
CREATE INDEX idx_usage_username_time ON internet_usage (username, time DESC);
CREATE INDEX idx_usage_ip_time ON internet_usage (ip_address, time DESC);
```

### Hypertable (TimescaleDB)

```sql
SELECT create_hypertable('internet_usage', 'time');
```

## 🧪 Testing

### Test NetFlow Collector

```bash
# Send test NetFlow v5 packet
# You'll need a NetFlow generator tool or use nfdump

# Verify collector is listening
netstat -an | grep 2055

# Check logs
cd backend
npm run netflow
# You should see: "NetFlow collector listening on UDP 0.0.0.0:2055"
```

### Test Username Resolution

```bash
# Test via Node.js
node -e "
const resolver = require('./backend/src/services/username-resolver');

resolver.resolveUsername('192.168.1.100')
  .then(username => console.log('Username:', username))
  .catch(err => console.error('Error:', err));
"
```

### Test API Endpoints

```bash
# Get top users (today)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/internet-usage/top-users?range=today

# Get overall stats
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/internet-usage/stats?range=week

# Search users
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/internet-usage/search?q=john"

# Export to CSV
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/internet-usage/export?range=today \
  -o usage.csv
```

## 📊 Example Queries

### Get Top 10 Users (SQL)

```sql
SELECT
  username,
  SUM(bytes_sent + bytes_received) as total_bytes
FROM internet_usage
WHERE time > NOW() - INTERVAL '1 day'
  AND username IS NOT NULL
GROUP BY username
ORDER BY total_bytes DESC
LIMIT 10;
```

### Get Usage by Hour (SQL)

```sql
SELECT
  date_trunc('hour', time) as hour,
  SUM(bytes_sent + bytes_received) as total_bytes,
  COUNT(DISTINCT ip_address) as unique_users
FROM internet_usage
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

### Get Protocol Distribution (SQL)

```sql
SELECT
  protocol,
  SUM(bytes_sent + bytes_received) as total_bytes,
  COUNT(*) as flow_count
FROM internet_usage
WHERE time > NOW() - INTERVAL '1 day'
GROUP BY protocol
ORDER BY total_bytes DESC;
```

## 🐛 Troubleshooting

### No NetFlow Data Received

1. **Check collector is running**:
   ```bash
   ps aux | grep netflow-worker
   ```

2. **Verify port is listening**:
   ```bash
   netstat -an | grep 2055
   ```

3. **Check firewall rules**:
   ```bash
   sudo iptables -L | grep 2055
   # Or
   sudo ufw status
   ```

4. **Test connectivity from firewall**:
   ```bash
   # From firewall, test UDP connectivity
   nc -u <monitoring_server_ip> 2055
   ```

5. **Check FortiGate export**:
   ```bash
   diagnose sniffer packet any 'udp port 2055' 4
   ```

### Username Not Resolved

1. **Check LDAP connectivity**:
   ```bash
   ldapsearch -x -H ldap://dc.digiskills.local \
     -b "DC=digiskills,DC=local" \
     "(sAMAccountName=*)" cn
   ```

2. **Check DNS reverse lookup**:
   ```bash
   nslookup 192.168.1.100
   ```

3. **Check resolver cache**:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/internet-usage/resolver/stats
   ```

### High Memory Usage

- NetFlow collector keeps flows in memory for aggregation
- Default buffer flush: every 60 seconds
- Reduce flush interval in `internet-usage-service.js`:
  ```javascript
  this.bufferFlushInterval = 30000; // 30 seconds instead of 60
  ```

### Database Growing Too Fast

- Implement data retention policy:
  ```sql
  DELETE FROM internet_usage
  WHERE time < NOW() - INTERVAL '90 days';
  ```

- Or use the service method:
  ```javascript
  internetUsageService.cleanupOldData(90); // Keep 90 days
  ```

## 📊 Performance

### Expected Performance

- **Flow processing**: 1000+ flows/second
- **Memory usage**: ~100-300 MB
- **CPU usage**: <5% when idle, spikes during packet bursts
- **Database growth**: ~5-10 MB per day (depends on traffic volume)

### Optimization Tips

1. **Increase aggregation window** (reduce database writes)
2. **Add more indexes** for frequently queried fields
3. **Implement data archiving** (move old data to cold storage)
4. **Use connection pooling** for database queries
5. **Enable compression** on TimescaleDB hypertables

## 🔒 Security

### Network Security

- **Firewall**: Restrict UDP 2055 to known firewall IPs
- **LDAP**: Use LDAPS (port 636) for encrypted communication
- **API**: All endpoints require JWT authentication

### Data Privacy

- **Username Exposure**: Consider data protection regulations
- **Retention Policy**: Implement automatic deletion of old data
- **Access Control**: Limit access to sensitive usage data
- **Audit Logging**: Log all data access and exports

### Credentials

- **LDAP Credentials**: Use read-only service account
- **Database**: Use principle of least privilege
- **API Keys**: Rotate JWT secrets regularly

## 🎉 What's Working

### Features Implemented

✅ NetFlow v5/v9 collector
✅ Real-time flow processing
✅ Username resolution (LDAP/DNS/Database)
✅ Automatic data aggregation
✅ Top users tracking
✅ Protocol distribution
✅ Time-series analytics
✅ User search
✅ CSV export
✅ Frontend dashboard
✅ Statistics visualization

### API Endpoints

✅ 10 new REST endpoints
✅ Query parameters for time ranges
✅ Search functionality
✅ Export functionality
✅ Admin-only cache management

### Frontend

✅ Real-time usage display
✅ Time range selector
✅ Top users table
✅ Protocol distribution charts
✅ User search
✅ CSV export button
✅ Statistics cards

## 🎯 What's Next

Phase 3 is complete! The system now tracks per-user internet bandwidth.

**Ready for Phase 4**:
- Zabbix API integration for internet link monitoring
- Link status synchronization
- Automatic failover detection

**Future Enhancements**:
- Real-time usage charts (Phase 5)
- Bandwidth alerts (Phase 6)
- Application identification (DPI)
- Geolocation for destinations

## 📞 Support

For issues or questions:
- Check the main README.md
- Review NetFlow worker logs
- Check firewall export configuration
- Verify network connectivity

---

**Phase 3 Completed**: November 20, 2025
**Version**: 1.0.0-phase3
