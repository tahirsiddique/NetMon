# Phase 2: Core Monitoring Engine - Complete

## What's Been Implemented

Phase 2 adds the core monitoring capabilities to collect real-time metrics from all infrastructure devices.

### 🎯 New Components

#### 1. SNMP Collector (`backend/src/services/collectors/snmp-collector.js`)

Collects metrics from network devices using SNMP protocol:

- **Dell Servers** (OpenManage SNMP OIDs)
  - System health status
  - PSU status
  - Temperature readings
  - Fan status
  - RAID disk status
  - CPU and memory usage

- **Network Switches** (IF-MIB)
  - Interface statistics
  - Bandwidth usage
  - Port status (up/down)
  - Traffic counters

- **FortiGate Firewalls**
  - CPU and memory usage
  - Active sessions
  - System uptime

- **pfSense Firewalls**
  - CPU and memory usage
  - System uptime

- **VMware ESXi Hosts**
  - CPU and memory usage
  - System uptime

#### 2. WMI Collector (`backend/src/services/collectors/wmi-collector.js`)

Collects metrics from Windows servers using WMI:

- **Operating System Info**
  - Windows version and build
  - Architecture
  - Last boot time

- **Performance Metrics**
  - CPU usage percentage
  - Memory usage (total, free, used)
  - Disk space per drive
  - System uptime

- **Windows Services**
  - Service status (Running, Stopped)
  - Service state
  - Start mode (Auto, Manual, Disabled)
  - Supports monitoring: NTDS, DNS, DHCP, and custom services

#### 3. Metrics Service (`backend/src/services/metrics-service.js`)

Handles storing and retrieving time-series data:

- Save metrics to TimescaleDB hypertable
- Store hardware health status
- Store Windows service status
- Update node status (up/down)
- Real-time broadcasting via WebSocket
- Metric aggregation and statistics
- Time-series queries with custom time ranges

#### 4. Background Monitoring Worker (`backend/src/workers/monitoring-worker.js`)

Bull Queue-based background job processor:

- Automatic scheduling of device monitoring
  - Critical infrastructure (ESXi, Windows servers, firewalls): **Every 1 minute**
  - Regular devices: **Every 5 minutes**

- Job processing with retry logic (3 attempts with exponential backoff)
- Parallel collection from multiple devices
- Automatic status updates (up/down)
- Queue statistics and monitoring

#### 5. Metrics API Controller (`backend/src/controllers/metrics.controller.js`)

New REST API endpoints for metrics:

```
GET    /api/metrics/node/:nodeId                    - Get all metrics for a node
GET    /api/metrics/node/:nodeId/available          - Get available metric types
GET    /api/metrics/node/:nodeId/:metricType/latest - Get latest value for a metric
GET    /api/metrics/node/:nodeId/:metricType/stats  - Get aggregated statistics
GET    /api/metrics/node/:nodeId/services           - Get Windows service status
GET    /api/metrics/node/:nodeId/hardware           - Get hardware health status
POST   /api/metrics/time-series                     - Get time-series data for charts
```

## 🚀 How to Use

### Start the Monitoring System

#### Option 1: Automated Script (Recommended)

```bash
# Start both API server and monitoring worker
./start-monitoring.sh
```

This script will:
- Check Docker services (PostgreSQL, Redis)
- Start API server on port 3000
- Start monitoring worker
- Display logs from both processes

#### Option 2: Manual Start

```bash
# Terminal 1: Start API server
cd backend
npm run dev

# Terminal 2: Start monitoring worker
cd backend
npm run worker

# Terminal 3: Start frontend
cd frontend
npm run dev
```

### Monitor the System

1. **View Logs**: The worker will log each collection attempt:
   ```
   [2025-11-20T...] Collecting metrics for: ESXi-Host-01 (esxi)
   ✓ Successfully collected metrics for ESXi-Host-01
   ```

2. **Check Queue Status**: Use Bull Board or query the queue programmatically

3. **View Metrics**: Access metrics via the API or dashboard

## 📊 How It Works

### Collection Flow

```
┌─────────────────┐
│   Scheduler     │  (Bull Queue with Cron)
│  Every 1-5 min  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Monitoring     │
│     Worker      │  (Process jobs in parallel)
└────────┬────────┘
         │
         ↓
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐ ┌─────────┐
│  SNMP   │ │   WMI   │  (Collect metrics)
│Collector│ │Collector│
└────┬────┘ └────┬────┘
     │           │
     └─────┬─────┘
           ↓
    ┌─────────────┐
    │   Metrics   │  (Store in TimescaleDB)
    │   Service   │
    └──────┬──────┘
           │
           ↓
    ┌─────────────┐
    │  WebSocket  │  (Broadcast updates)
    │  Broadcast  │
    └─────────────┘
```

### Data Storage

- **metrics** table: Time-series data with automatic partitioning
- **hardware_health** table: Component status history
- **service_status** table: Windows service status history
- **nodes** table: Updated with last_seen and status

### Real-time Updates

When metrics are collected:
1. Data is stored in TimescaleDB
2. Node status is updated (up/down)
3. Updates are broadcast via WebSocket to connected clients
4. Dashboard automatically refreshes

## 🔧 Configuration

### Device Credentials

Set in `.env` or per-device in `metadata`:

```bash
# SNMP community string
SNMP_COMMUNITY=public

# WMI credentials for Windows
WMI_USERNAME=DIGISKILLS\\monitor_service
WMI_PASSWORD=ServiceAccountPassword
```

### Per-Device Configuration

In the `nodes` table, `metadata` field (JSONB):

```json
{
  "snmp_community": "private",
  "wmi_username": "domain\\user",
  "wmi_password": "password",
  "monitored_services": ["NTDS", "DNS", "DHCP", "W32Time"]
}
```

### Polling Intervals

Modify in `backend/src/workers/monitoring-worker.js`:

```javascript
const isCritical = ['esxi', 'windows_server', 'fortigate'].includes(device.type);
const cronInterval = isCritical ? '*/1 * * * *' : '*/5 * * * *';
```

## 📈 Metrics Collected

### Dell Servers
- system_health, psu_status, fan_status, disk_status
- temperature_celsius
- cpu_usage_percent, memory_usage_percent

### Network Switches
- interface_count, interfaces_up, interfaces_down
- total_bytes_in, total_bytes_out
- Per-interface statistics

### Firewalls (FortiGate/pfSense)
- cpu_usage_percent, memory_usage_percent
- active_sessions (FortiGate)
- uptime_seconds

### VMware ESXi
- cpu_usage_percent, memory_usage_percent
- uptime_seconds

### Windows Servers
- cpu_usage_percent
- memory (total_mb, used_mb, usage_percent)
- disks (per drive: total_gb, used_gb, usage_percent)
- services (NTDS, DNS, DHCP status)
- uptime_hours

## 🧪 Testing

### Test SNMP Collection

```bash
# Manual test of SNMP collector
node -e "
const SNMPCollector = require('./backend/src/services/collectors/snmp-collector');
const collector = new SNMPCollector();

const device = {
  name: 'Test Device',
  type: 'dell_server',
  ip_address: '192.168.1.10',
  metadata: { snmp_community: 'public' }
};

collector.collectDeviceMetrics(device)
  .then(result => console.log('Result:', JSON.stringify(result, null, 2)))
  .catch(err => console.error('Error:', err));
"
```

### Test WMI Collection

```bash
# Manual test of WMI collector
node -e "
const WMICollector = require('./backend/src/services/collectors/wmi-collector');
const collector = new WMICollector();

const device = {
  name: 'DC-01',
  type: 'windows_server',
  ip_address: '192.168.1.20',
  metadata: {
    wmi_username: 'DOMAIN\\user',
    wmi_password: 'password',
    monitored_services: ['NTDS', 'DNS']
  }
};

collector.collectWindowsMetrics(device)
  .then(result => console.log('Result:', JSON.stringify(result, null, 2)))
  .catch(err => console.error('Error:', err));
"
```

### View Queue Jobs

Access Bull Board (if installed) or query programmatically:

```javascript
const { getQueueStatus } = require('./backend/src/workers/monitoring-worker');

getQueueStatus().then(status => console.log(status));
// Output: { waiting: 0, active: 5, completed: 120, failed: 2, delayed: 0 }
```

## 🐛 Troubleshooting

### No Metrics Being Collected

1. **Check worker is running**:
   ```bash
   ps aux | grep "node.*workers"
   ```

2. **Check Redis connection**:
   ```bash
   docker exec -it digiskills_redis redis-cli ping
   ```

3. **Check worker logs** for errors

### SNMP Collection Failing

1. **Verify SNMP is enabled** on the target device
2. **Test SNMP manually**:
   ```bash
   snmpwalk -v2c -c public 192.168.1.10 system
   ```
3. **Check firewall** allows UDP port 161
4. **Verify community string** is correct

### WMI Collection Failing

1. **Check Windows Firewall** allows WMI
2. **Verify credentials** have admin privileges
3. **Test WMI manually**:
   ```powershell
   Get-WmiObject -ComputerName 192.168.1.20 -Class Win32_OperatingSystem
   ```
4. **Enable WMI** if disabled

### High Memory Usage

- Bull Queue keeps job history in memory
- Reduce `removeOnComplete` and `removeOnFail` in worker config
- Implement job cleanup:
  ```javascript
  monitoringQueue.clean(3600000); // Clean jobs older than 1 hour
  ```

## 📊 Performance

### Expected Performance

- **Collection time per device**: 2-5 seconds
- **Concurrent collections**: Up to 10 devices in parallel
- **Memory usage**: ~200-500 MB (depends on device count)
- **CPU usage**: Low (<10%) when idle, spikes during collection
- **Database growth**: ~1 MB per device per day

### Optimization Tips

1. **Increase polling intervals** for non-critical devices
2. **Use SNMP instead of WMI** where possible (faster)
3. **Limit metric types** collected
4. **Implement data retention policy** (delete old metrics)
5. **Use Redis clustering** for high-scale deployments

## 🔒 Security

### Network Access

- SNMP uses **UDP port 161** (outbound from monitoring server)
- WMI uses **TCP ports 135, 445, 49152-65535**
- Firewall rules should allow monitoring server IP

### Credentials

- Store credentials in environment variables or encrypted config
- Use **read-only accounts** for WMI queries
- Use **SNMPv3 with authentication** in production (currently v2c)
- Implement **credential rotation** policy

### Data Access

- All API endpoints require JWT authentication
- Metrics data is only accessible to authenticated users
- Implement **role-based access** for sensitive metrics

## 🎉 What's Next

Phase 2 is complete! The monitoring engine is now collecting real-time metrics from all infrastructure.

**Next Steps**:
- **Phase 3**: NetFlow/sFlow collector for per-user internet usage
- **Phase 4**: Zabbix API integration
- **Phase 5**: Interactive charts and visualizations
- **Phase 6**: Email alerting system

## 📞 Support

For issues or questions:
- Check the main README.md
- Review worker logs: `backend/logs/worker.log`
- Check API logs: `backend/logs/api.log`

---

**Phase 2 Completed**: November 20, 2025
**Version**: 1.0.0-phase2
