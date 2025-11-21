# Digiskills Network Monitoring System

A comprehensive, production-ready web-based network infrastructure monitoring system for the Digiskills IT Department. This "Single Pane of Glass" dashboard consolidates monitoring data from heterogeneous IT infrastructure including VMware ESXi hosts, Windows Servers, Dell hardware, network devices, and client workstations.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-green.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

## 🎯 Key Features

### Infrastructure Monitoring
- **Real-time Dashboard**: Live monitoring with WebSocket updates
- **Multi-Device Support**: ESXi hosts, Windows servers, Dell hardware, network devices
- **Performance Metrics**: CPU, memory, disk, network bandwidth tracking
- **Historical Data**: TimescaleDB for time-series analysis

### Internet Usage Tracking
- **Per-User Analytics**: NetFlow/sFlow integration for bandwidth monitoring
- **Usage Reports**: Daily, weekly, monthly consumption tracking
- **Top Users Dashboard**: Identify bandwidth consumers
- **Traffic Analysis**: Protocol and destination tracking

### Zabbix Integration
- **Internet Link Monitoring**: Monitor WAN connections via Zabbix
- **Automated Sync**: Real-time integration with Zabbix API
- **Uptime Tracking**: Link availability and performance metrics
- **Alert Integration**: Unified alerting across platforms

### Intelligent Alerting
- **Rule Engine**: Configurable alert rules for all metrics
- **Email Notifications**: SMTP integration for instant alerts
- **Severity Levels**: Critical, warning, info classifications
- **Alert Management**: Acknowledgment and resolution workflow
- **Auto-Resolution**: Alerts resolve when conditions normalize

### Advanced Security
- **Audit Logging**: Complete event tracking for compliance
- **Session Management**: Token-based authentication with tracking
- **Login Protection**: IP-based lockout after failed attempts
- **Security Dashboard**: Monitor security events and user activity
- **Role-Based Access**: Admin and operator roles with granular permissions

### Production Deployment
- **Docker Containerization**: Multi-stage optimized images
- **Load Balancing**: Nginx reverse proxy with dual backend instances
- **Automated Backups**: Scheduled database backups with retention
- **Health Monitoring**: Comprehensive health checks and alerting
- **SSL/TLS Ready**: HTTPS support with Let's Encrypt integration
- **High Availability**: Scalable architecture with Redis clustering

## 🏗️ Technology Stack

### Backend
- **Runtime**: Node.js 18 with Express.js
- **Database**: PostgreSQL 14 with TimescaleDB extension
- **Cache**: Redis 7 for session storage and caching
- **Queue**: Bull Queue for background job processing
- **WebSocket**: Socket.io for real-time updates
- **Monitoring**: SNMP, WMI, NetFlow/sFlow collectors
- **Email**: Nodemailer with SMTP support

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS 3
- **State Management**: Zustand
- **Charts**: Recharts and Chart.js
- **Icons**: Lucide React
- **HTTP Client**: Axios

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx with load balancing
- **SSL/TLS**: Let's Encrypt / self-signed certificates
- **Monitoring**: Built-in health checks

## 📋 Prerequisites

### For Development
- Node.js 18+ and npm
- Docker and Docker Compose
- Git

### For Production Deployment
- Linux server (Ubuntu 20.04+ recommended)
- Docker 20.10+ and Docker Compose 1.29+
- 4GB RAM minimum (8GB recommended)
- 50GB disk space
- Network access to monitored devices
- SMTP server for email alerts

## 🚀 Quick Start

### Option 1: Production Deployment (Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd NetMon

# 2. Configure environment
cp .env.production.example .env.production
nano .env.production  # Update passwords and settings

# 3. Install and start
./scripts/deploy.sh install

# 4. Access the application
# http://your-server-ip or http://localhost
```

Default credentials:
- **Username**: admin
- **Password**: admin (change immediately!)

### Option 2: Development Setup

```bash
# 1. Start infrastructure services
docker-compose up -d postgres redis

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 3. Initialize database
cd backend
npm run migrate
npm run seed

# 4. Start development servers
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# 5. Access at http://localhost:5173
```

### Option 3: Using Make (Simplest)

```bash
# Development
make dev

# Production
make install
make start

# View logs
make logs

# Backup database
make backup
```

## 📁 Project Structure

```
NetMon/
├── backend/                      # Backend Node.js application
│   ├── src/
│   │   ├── config/              # Database, Redis, Socket.io config
│   │   ├── controllers/         # API route controllers
│   │   ├── middleware/          # Auth, security, validation
│   │   ├── services/            # Business logic
│   │   │   ├── collectors/      # SNMP, WMI, NetFlow collectors
│   │   │   ├── alert-rules-service.js
│   │   │   ├── email-notification-service.js
│   │   │   └── audit-logger.js
│   │   ├── workers/             # Background job processors
│   │   │   └── alert-worker.js
│   │   └── server.js            # Application entry point
│   ├── Dockerfile               # Production container image
│   └── package.json
│
├── frontend/                     # React frontend application
│   ├── src/
│   │   ├── components/          # Reusable React components
│   │   ├── pages/               # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Nodes.jsx
│   │   │   ├── Alerts.jsx
│   │   │   ├── InternetUsage.jsx
│   │   │   ├── InternetLinks.jsx
│   │   │   ├── Security.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/            # API and WebSocket clients
│   │   ├── store/               # State management
│   │   └── App.jsx
│   ├── Dockerfile               # Production container image
│   ├── nginx.conf               # Nginx configuration
│   └── package.json
│
├── nginx/                        # Nginx reverse proxy config
│   ├── nginx.conf               # Main configuration
│   ├── conf.d/                  # Site configurations
│   └── ssl/                     # SSL certificates
│
├── scripts/                      # Deployment and maintenance scripts
│   ├── deploy.sh                # Main deployment script
│   ├── backup.sh                # Database backup
│   ├── restore.sh               # Database restore
│   └── monitor.sh               # Health monitoring
│
├── backups/                      # Database backups directory
├── docker-compose.yml            # Production orchestration
├── docker-compose.dev.yml        # Development orchestration
├── Makefile                      # Simplified commands
├── .env.production.example       # Production config template
│
├── PHASE2_README.md             # Core monitoring documentation
├── PHASE3_README.md             # Internet usage documentation
├── PHASE4_README.md             # Zabbix integration documentation
├── PHASE5_README.md             # Dashboard visualization documentation
├── PHASE6_README.md             # Alerting system documentation
├── PHASE7_README.md             # Security & audit documentation
├── PHASE8_README.md             # Deployment documentation
├── CHANGELOG.md                 # Version history
└── README.md                    # This file
```

## 🔧 Configuration

### Environment Variables

Production configuration (`.env.production`):

```bash
# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://monitor.digiskills.local

# Database
DB_HOST=postgres
DB_NAME=digiskills_monitor
DB_USER=monitor_user
DB_PASSWORD=CHANGE_THIS_PASSWORD

# Redis
REDIS_HOST=redis
REDIS_PASSWORD=CHANGE_THIS_PASSWORD

# Authentication
JWT_SECRET=GENERATE_WITH_OPENSSL_RAND_BASE64_64

# Email Alerts
SMTP_HOST=smtp.digiskills.local
SMTP_PORT=587
SMTP_USER=monitor@digiskills.local
SMTP_PASS=CHANGE_THIS_PASSWORD
ADMIN_EMAIL=admin@digiskills.local

# Zabbix Integration
ZABBIX_API_URL=http://zabbix.digiskills.local/api_jsonrpc.php
ZABBIX_API_USER=Admin
ZABBIX_API_PASSWORD=CHANGE_THIS_PASSWORD

# Backup
BACKUP_RETENTION_DAYS=30
```

See `.env.production.example` for complete configuration options.

## 📚 Documentation

### Phase Documentation
- **[Phase 2: Core Monitoring](PHASE2_README.md)** - SNMP, WMI collectors, metrics collection
- **[Phase 3: Internet Usage Tracking](PHASE3_README.md)** - NetFlow/sFlow, per-user analytics
- **[Phase 4: Zabbix Integration](PHASE4_README.md)** - Internet link monitoring
- **[Phase 5: Dashboard Enhancements](PHASE5_README.md)** - Recharts visualizations
- **[Phase 6: Alerting System](PHASE6_README.md)** - Alert rules, email notifications
- **[Phase 7: Security & Audit](PHASE7_README.md)** - Audit logging, session management
- **[Phase 8: Production Deployment](PHASE8_README.md)** - Docker, load balancing, backups

### Quick Reference
- **API Documentation**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health
- **Readiness Check**: http://localhost:3000/ready

## 🎓 Development Roadmap

### ✅ Phase 1-2: Foundation & Core Monitoring (Completed)
- [x] Project structure and initialization
- [x] PostgreSQL with TimescaleDB
- [x] Redis configuration
- [x] Express.js backend with JWT authentication
- [x] React frontend with Tailwind CSS
- [x] WebSocket real-time updates
- [x] SNMP collector for network devices
- [x] WMI collector for Windows servers
- [x] Bull Queue background workers
- [x] Metrics collection and storage

### ✅ Phase 3: Internet Usage Tracking (Completed)
- [x] NetFlow/sFlow collector implementation
- [x] Per-user bandwidth tracking
- [x] Usage analytics and reporting
- [x] Top users dashboard
- [x] Historical usage charts

### ✅ Phase 4: Zabbix Integration (Completed)
- [x] Zabbix API client
- [x] Internet link monitoring
- [x] Automated synchronization
- [x] Uptime and performance tracking
- [x] Alert integration

### ✅ Phase 5: Dashboard Enhancements (Completed)
- [x] Recharts integration
- [x] Interactive visualizations
- [x] Real-time metric charts
- [x] Usage trend graphs
- [x] Performance analytics

### ✅ Phase 6: Alerting System (Completed)
- [x] Alert rule engine
- [x] Email notification service
- [x] Alert management UI
- [x] Severity classifications
- [x] Auto-resolution logic
- [x] Alert acknowledgment workflow

### ✅ Phase 7: Advanced Security (Completed)
- [x] Comprehensive audit logging
- [x] Session management
- [x] Login lockout protection
- [x] Security dashboard
- [x] User activity tracking
- [x] Compliance reporting

### ✅ Phase 8: Production Deployment (Completed)
- [x] Docker containerization
- [x] Docker Compose orchestration
- [x] Nginx load balancing
- [x] Automated backup system
- [x] Health monitoring
- [x] SSL/TLS support
- [x] Deployment automation scripts
- [x] Production configuration

## 🚢 Deployment Commands

### Using Deploy Script

```bash
# First-time installation
./scripts/deploy.sh install

# Start services
./scripts/deploy.sh start

# Stop services
./scripts/deploy.sh stop

# Restart services
./scripts/deploy.sh restart

# View status
./scripts/deploy.sh status

# View logs (all services)
./scripts/deploy.sh logs

# View logs (specific service)
./scripts/deploy.sh logs backend-1

# Update deployment
./scripts/deploy.sh update

# Run backup
./scripts/deploy.sh backup
```

### Using Make

```bash
# Development
make dev              # Start development servers
make dev-build        # Build development images

# Production
make install          # First-time installation
make start            # Start all services
make stop             # Stop all services
make restart          # Restart all services
make status           # Show service status

# Maintenance
make logs             # View all logs
make logs-backend     # View backend logs
make logs-frontend    # View frontend logs
make backup           # Run database backup
make restore          # Restore database
make health           # Run health checks

# Cleanup
make clean            # Remove containers
make clean-all        # Remove containers and volumes
```

### Using Docker Compose Directly

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild images
docker-compose build

# Scale backend
docker-compose up -d --scale backend-1=3
```

## 🔍 Monitoring and Maintenance

### Health Checks

```bash
# Run comprehensive health check
./scripts/monitor.sh

# Check specific service
docker-compose ps backend-1

# View resource usage
docker stats
```

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend-1

# Last 100 lines
docker-compose logs --tail=100 backend-1

# Application logs
tail -f backend/logs/app.log
```

### Backups

```bash
# Manual backup
./scripts/deploy.sh backup

# Restore from backup
./scripts/restore.sh /backups/netmon_backup_20250120_140530.sql.gz

# Automated backup (cron)
0 2 * * * cd /path/to/NetMon && ./scripts/deploy.sh backup
```

### Updates

```bash
# Pull latest code and rebuild
./scripts/deploy.sh update

# Or manually
git pull
docker-compose build
docker-compose up -d
```

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker exec -it netmon-postgres psql -U monitor_user -d digiskills_monitor

# Verify database health
curl http://localhost:3000/health
```

### Backend Issues

```bash
# Check backend logs
docker-compose logs backend-1

# Restart backend
docker-compose restart backend-1

# Check health endpoint
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

### Frontend Not Loading

```bash
# Check frontend logs
docker-compose logs frontend

# Check Nginx logs
docker-compose logs nginx

# Verify frontend is running
curl http://localhost/
```

### Email Alerts Not Working

```bash
# Test SMTP configuration
curl -X POST http://localhost:3000/api/alerts/test-email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check alert worker logs
docker-compose logs alert-worker

# Verify SMTP settings in .env.production
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check database performance
docker exec netmon-postgres psql -U monitor_user -d digiskills_monitor \
  -c "SELECT * FROM pg_stat_activity;"

# Check Redis memory
docker exec netmon-redis redis-cli INFO memory

# View slow queries
docker-compose logs backend-1 | grep "slow query"
```

## 🔒 Security Best Practices

1. **Change Default Credentials**
   - Admin password
   - Database passwords
   - Redis password
   - JWT secret

2. **Enable HTTPS**
   ```bash
   # Generate Let's Encrypt certificate
   certbot certonly --standalone -d monitor.digiskills.local

   # Copy certificates
   cp /etc/letsencrypt/live/monitor.digiskills.local/fullchain.pem nginx/ssl/cert.pem
   cp /etc/letsencrypt/live/monitor.digiskills.local/privkey.pem nginx/ssl/key.pem

   # Enable HTTPS in .env.production
   ENABLE_HTTPS=true

   # Restart nginx
   docker-compose restart nginx
   ```

3. **Configure Firewall**
   ```bash
   ufw allow 22/tcp   # SSH
   ufw allow 80/tcp   # HTTP
   ufw allow 443/tcp  # HTTPS
   ufw enable
   ```

4. **Regular Updates**
   ```bash
   # Update Docker images
   docker-compose pull
   docker-compose up -d

   # Update application
   git pull
   ./scripts/deploy.sh update
   ```

5. **Monitor Security Events**
   - Check audit logs daily in Security dashboard
   - Review failed login attempts
   - Monitor unusual activity

## 📊 Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Nginx Load Balancer                  │
│              (Reverse Proxy, SSL/TLS, Rate Limiting)     │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
┌────────▼─────────┐        ┌────────▼─────────┐
│   Backend-1      │        │   Backend-2      │
│   (Node.js)      │        │   (Node.js)      │
└────────┬─────────┘        └────────┬─────────┘
         │                           │
         └─────────────┬─────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
┌────────▼─────┐ ┌────▼──────┐ ┌───▼────────┐
│  PostgreSQL  │ │   Redis   │ │  Frontend  │
│ (TimescaleDB)│ │  (Cache)  │ │   (React)  │
└──────────────┘ └───────────┘ └────────────┘
         │
┌────────▼─────────┐
│  Alert Worker    │
│ (Background Jobs)│
└──────────────────┘
```

### Data Flow

1. **Client Request** → Nginx → Backend (Load Balanced) → Database/Redis
2. **Real-time Updates** → WebSocket → Client
3. **Background Jobs** → Alert Worker → Email Service
4. **Monitoring Data** → Collectors → Database → Dashboard

## 🤝 Contributing

This is a proprietary system for Digiskills IT Department. For internal contributions:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit for review

## 📄 License

Proprietary - Digiskills IT Department © 2025

All rights reserved. Unauthorized copying, distribution, or modification of this software is strictly prohibited.

## 📞 Support

For issues, questions, or feature requests:
- **Email**: it-support@digiskills.local
- **Internal Wiki**: https://wiki.digiskills.local/netmon
- **Issue Tracker**: Internal GitLab

## 🙏 Acknowledgments

- Digiskills IT Department
- Development Team
- Network Operations Team

---

**Version**: 2.0.0
**Last Updated**: January 20, 2025
**Status**: Production Ready ✅

**All 8 Phases Complete** 🎉
