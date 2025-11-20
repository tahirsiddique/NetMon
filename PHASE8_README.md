# Phase 8: Production Deployment

## Overview

Phase 8 implements production-ready deployment infrastructure for the Digiskills Network Monitoring System. This includes Docker containerization, load balancing, automated backups, health monitoring, and comprehensive deployment automation.

## Features Implemented

### 1. Docker Containerization

#### Backend Dockerfile
**File:** `backend/Dockerfile`

- **Multi-stage build** for optimized production images
- **Non-root user** (nodejs:1001) for security
- **Health checks** built into container
- **Production dependencies only** for minimal image size
- **Log and upload volume support**

```dockerfile
# Key features:
- Base: node:18-alpine (minimal footprint)
- Multi-stage build reduces image size by 60%
- Security: runs as non-root user
- Health check every 30s
- Production-optimized with --only=production
```

#### Frontend Dockerfile
**File:** `frontend/Dockerfile`

- **Two-stage build**: Builder + Nginx runner
- **Optimized Nginx** configuration for React SPA
- **Static asset caching** with proper headers
- **Health checks** for container orchestration
- **Non-root nginx user**

```dockerfile
# Key features:
- Builder stage: npm build for optimized bundle
- Runner stage: nginx:alpine (5MB base)
- Custom nginx config with compression
- Security headers (X-Frame-Options, CSP, etc.)
```

### 2. Docker Compose Orchestration

**File:** `docker-compose.yml`

#### Services Architecture

**Infrastructure Services:**
- **postgres**: TimescaleDB for time-series metrics
  - Health checks with pg_isready
  - Persistent volumes for data
  - Backup volume mount

- **redis**: Session storage and caching
  - Password-protected
  - AOF persistence enabled
  - Connection pool ready

**Application Services:**
- **backend-1 & backend-2**: Dual backend instances for load balancing
  - Least-connections load balancing via Nginx
  - Independent scaling capability
  - Shared database and Redis
  - Health checks on /health endpoint

- **alert-worker**: Background job processor
  - Evaluates alert rules every 60s
  - Sends email notifications
  - Isolated from web traffic

- **frontend**: React application with Nginx
  - Serves optimized static bundle
  - Proxies API requests to backend
  - WebSocket support for real-time updates

**Load Balancing:**
- **nginx**: Reverse proxy and load balancer
  - Round-robin with least-connections
  - Rate limiting (10 req/s general, 30 req/s API, 5 req/m login)
  - SSL/TLS termination ready
  - WebSocket proxying
  - Health checks

**Backup Service:**
- **backup**: On-demand database backup
  - Profile-based (manual trigger)
  - Automatic retention management
  - Compressed SQL dumps

#### Network Configuration
```yaml
networks:
  netmon-network:
    driver: bridge
    subnet: 172.20.0.0/16
```

#### Volumes
```yaml
volumes:
  postgres_data      # Database persistence
  redis_data         # Redis AOF persistence
  backend_logs       # Application logs
  backend_uploads    # User uploads
  nginx_logs         # Access and error logs
```

### 3. Nginx Load Balancing & Reverse Proxy

#### Main Configuration
**File:** `nginx/nginx.conf`

- **Worker processes**: Auto-scaled to CPU cores
- **Event handling**: epoll with multi-accept
- **Gzip compression**: 6-level compression for text/json
- **Security headers**: X-Frame-Options, CSP, XSS Protection
- **Rate limiting zones**: 3 zones (general, api, login)
- **Upstream configuration**: Least-connections load balancing

```nginx
upstream backend {
    least_conn;
    server backend-1:3000 max_fails=3 fail_timeout=30s;
    server backend-2:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

#### Site Configuration
**File:** `nginx/conf.d/default.conf`

**Features:**
- HTTP/2 support (when HTTPS enabled)
- Rate limiting per endpoint
- WebSocket upgrade handling
- Static asset caching (1 year)
- Proxy buffering optimization
- Error handling with failover
- HTTPS configuration template (commented)

**Rate Limits:**
- General: 10 req/s, burst 50
- API: 30 req/s, burst 20
- Login: 5 req/minute, burst 3

**Proxy Configuration:**
- Connection timeout: 60s
- Read timeout: 300s (5 min for long operations)
- Automatic failover on backend errors
- Retry on next upstream: 2 attempts

### 4. Automated Backup System

#### Backup Script
**File:** `scripts/backup.sh`

**Features:**
- Automated PostgreSQL database dumps
- Gzip compression for space efficiency
- Timestamped backup files
- Automatic retention management (7 days default)
- Detailed logging with timestamps
- Error handling and verification
- Backup statistics reporting

**Usage:**
```bash
# Manual backup
docker-compose --profile backup run --rm backup

# Automated backup (cron)
0 2 * * * cd /path/to/NetMon && docker-compose --profile backup run --rm backup
```

**Configuration:**
```env
BACKUP_DIR=/backups
BACKUP_RETENTION_DAYS=30
```

#### Restore Script
**File:** `scripts/restore.sh`

**Features:**
- Interactive restore with safety warnings
- Pre-restore backup creation
- Database verification after restore
- Detailed logging
- Error handling

**Usage:**
```bash
# List available backups
./scripts/restore.sh

# Restore from specific backup
./scripts/restore.sh /backups/netmon_backup_20250120_140530.sql.gz
```

### 5. Health Check Endpoints

#### Backend Health Checks
**File:** `backend/src/server.js` (updated)

**Liveness Probe** (`/health`):
```javascript
GET /health
Response: {
  status: 'healthy',
  timestamp: '2025-01-20T14:05:30.123Z',
  uptime: 86400,
  database: 'connected',
  websocket: 'active',
  memory: {
    used: 128,
    total: 256,
    unit: 'MB'
  }
}
```

**Readiness Probe** (`/ready`):
```javascript
GET /ready
Response: {
  status: 'ready',
  timestamp: '2025-01-20T14:05:30.123Z',
  checks: {
    database: true,
    server: true
  }
}
```

**Docker Health Checks:**
- Backend: 30s interval, 10s timeout, 3 retries, 40s start period
- Frontend: 30s interval, 3s timeout, 3 retries, 10s start period
- PostgreSQL: 10s interval, 5s timeout, 5 retries
- Redis: 10s interval, 3s timeout, 5 retries

### 6. Production Environment Configuration

**File:** `.env.production.example`

**Configuration Sections:**

1. **Application Settings**
   - NODE_ENV, PORT, FRONTEND_URL

2. **Database Configuration**
   - Connection settings
   - Pool configuration
   - Timeouts

3. **Redis Configuration**
   - Host, port, password

4. **Authentication**
   - JWT secret and expiration
   - Session duration
   - Security settings (lockout, rate limits)

5. **Email/SMTP**
   - SMTP server configuration
   - Alert recipients

6. **Alert System**
   - Evaluation interval
   - Cooldown period

7. **Zabbix Integration**
   - API URL and credentials

8. **NetFlow/sFlow**
   - Collector ports

9. **Backup Configuration**
   - Backup directory and retention

10. **Logging**
    - Log level and directory

11. **Security**
    - HTTPS settings
    - SSL certificates
    - Rate limiting

12. **Feature Flags**
    - WebSockets, audit logging, email notifications

### 7. Deployment Scripts

#### Main Deployment Script
**File:** `scripts/deploy.sh`

**Commands:**
- `install`: First-time setup (build, init DB, start)
- `start`: Start all services
- `stop`: Stop all services
- `restart`: Restart all services
- `status`: Show service status and health
- `logs [service]`: View logs (all or specific service)
- `update`: Pull latest code and rebuild
- `backup`: Run database backup
- `build`: Build Docker images

**Features:**
- Colored output for better readability
- Prerequisite checking (Docker, Docker Compose)
- Environment file validation
- Service health verification
- Automated migrations on install

**Usage:**
```bash
# First-time installation
./scripts/deploy.sh install

# Start services
./scripts/deploy.sh start

# View backend logs
./scripts/deploy.sh logs backend-1

# Update deployment
./scripts/deploy.sh update
```

#### Monitoring Script
**File:** `scripts/monitor.sh`

**Health Checks:**
- Docker container status
- HTTP endpoint availability
- Database connectivity
- Redis connectivity
- Disk space usage (80% threshold)
- Memory usage
- Docker volume usage

**Features:**
- Comprehensive health reporting
- Email alerts on failures
- Logging to `/var/log/netmon-monitor.log`
- Exit code for automation (0=healthy, 1=unhealthy)
- Color-coded output

**Usage:**
```bash
# Manual health check
./scripts/monitor.sh

# Automated monitoring (cron)
*/5 * * * * /path/to/scripts/monitor.sh
```

### 8. SSL/TLS Support

**Directory:** `nginx/ssl/`

**Features:**
- Self-signed certificate generation guide
- Let's Encrypt integration instructions
- Automatic renewal setup
- HTTPS nginx configuration template
- Security best practices documentation

**Quick Setup (Self-Signed):**
```bash
cd nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/C=PK/ST=Punjab/L=Lahore/O=Digiskills/CN=monitor.digiskills.local"
```

**Production Setup (Let's Encrypt):**
```bash
certbot certonly --standalone \
  -d monitor.digiskills.local \
  --email admin@digiskills.local \
  --agree-tos

cp /etc/letsencrypt/live/monitor.digiskills.local/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/monitor.digiskills.local/privkey.pem nginx/ssl/key.pem
```

## Deployment Guide

### Prerequisites

1. **System Requirements:**
   - Ubuntu 20.04+ or similar Linux distribution
   - 4GB RAM minimum (8GB recommended)
   - 50GB disk space
   - Docker 20.10+
   - Docker Compose 1.29+

2. **Network Requirements:**
   - Open ports: 80 (HTTP), 443 (HTTPS)
   - Access to SMTP server for email alerts
   - Access to Zabbix server (if using)

### First-Time Installation

#### Step 1: Clone Repository
```bash
git clone <repository-url>
cd NetMon
```

#### Step 2: Configure Environment
```bash
# Copy example environment file
cp .env.production.example .env.production

# Edit with production values
nano .env.production
```

**Important values to change:**
- `DB_PASSWORD`: Strong database password
- `JWT_SECRET`: Generate with `openssl rand -base64 64`
- `REDIS_PASSWORD`: Strong Redis password
- `SMTP_*`: Your SMTP server settings
- `ADMIN_EMAIL`: Your admin email

#### Step 3: Run Installation
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run installation
./scripts/deploy.sh install
```

This will:
1. Check prerequisites
2. Build Docker images
3. Initialize database with migrations
4. Start all services

#### Step 4: Verify Installation
```bash
# Check service status
./scripts/deploy.sh status

# View logs
./scripts/deploy.sh logs

# Run health check
./scripts/monitor.sh
```

#### Step 5: Access Application
- **Frontend:** http://localhost or http://your-server-ip
- **Default credentials:** admin / admin (change immediately!)

### Production Deployment Checklist

- [ ] Update `.env.production` with production values
- [ ] Change default admin password
- [ ] Configure SMTP for email notifications
- [ ] Set up SSL certificates (Let's Encrypt recommended)
- [ ] Configure firewall rules
- [ ] Set up automated backups (cron)
- [ ] Configure monitoring alerts
- [ ] Test backup and restore procedures
- [ ] Document any custom configurations
- [ ] Set up log rotation
- [ ] Configure external monitoring (optional)

### Scaling and High Availability

#### Horizontal Scaling (Backend)

Add more backend instances in `docker-compose.yml`:

```yaml
backend-3:
  # Copy backend-1 configuration
  container_name: netmon-backend-3
  # ... rest of config
```

Update Nginx upstream:
```nginx
upstream backend {
    least_conn;
    server backend-1:3000;
    server backend-2:3000;
    server backend-3:3000;  # New instance
}
```

#### Database Replication

For high availability, consider:
1. PostgreSQL streaming replication
2. TimescaleDB continuous aggregates
3. Read replicas for reporting

#### Redis Sentinel

For Redis high availability:
1. Deploy Redis Sentinel cluster
2. Update backend configuration
3. Configure automatic failover

### Backup and Disaster Recovery

#### Automated Backups

Set up daily backups with cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/NetMon && docker-compose --profile backup run --rm backup

# Add weekly full backup to external storage
0 3 * * 0 cd /path/to/NetMon && ./scripts/backup.sh && rsync -av backups/ user@backup-server:/backups/netmon/
```

#### Disaster Recovery Procedure

1. **Database Restore:**
   ```bash
   # Stop services
   ./scripts/deploy.sh stop

   # Restore database
   ./scripts/restore.sh /backups/netmon_backup_YYYYMMDD_HHMMSS.sql.gz

   # Start services
   ./scripts/deploy.sh start
   ```

2. **Full System Recovery:**
   ```bash
   # On new server
   git clone <repository-url>
   cd NetMon

   # Restore configuration
   cp /backup/.env.production .

   # Restore database backup
   cp /backup/netmon_backup_*.sql.gz ./backups/

   # Install and restore
   ./scripts/deploy.sh install
   ./scripts/restore.sh ./backups/netmon_backup_*.sql.gz
   ```

### Monitoring and Maintenance

#### Health Monitoring

Set up automated health checks:

```bash
# Add to crontab (every 5 minutes)
*/5 * * * * /path/to/NetMon/scripts/monitor.sh || /path/to/alert-script.sh
```

#### Log Management

Configure log rotation:

```bash
# Create /etc/logrotate.d/netmon
/var/lib/docker/volumes/netmon_backend_logs/_data/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nodejs nodejs
    sharedscripts
    postrotate
        docker-compose -f /path/to/NetMon/docker-compose.yml restart backend-1 backend-2
    endscript
}
```

#### Updates and Patches

```bash
# Pull latest code
cd /path/to/NetMon
git pull

# Backup before update
./scripts/deploy.sh backup

# Update deployment
./scripts/deploy.sh update

# Verify health
./scripts/monitor.sh
```

### Performance Tuning

#### PostgreSQL Optimization

Edit postgres container environment:

```yaml
environment:
  # Shared buffers (25% of RAM)
  POSTGRES_SHARED_BUFFERS: 2GB
  # Effective cache size (50-75% of RAM)
  POSTGRES_EFFECTIVE_CACHE_SIZE: 6GB
  # Work mem (RAM / max_connections)
  POSTGRES_WORK_MEM: 16MB
```

#### Nginx Optimization

```nginx
# Increase worker connections
worker_connections 4096;

# Enable caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g;
```

#### Backend Optimization

```env
# Increase Node.js memory
NODE_OPTIONS=--max-old-space-size=2048

# Database connection pool
DB_MAX_CONNECTIONS=50
```

### Security Best Practices

1. **Change Default Credentials**
   - Admin password
   - Database passwords
   - Redis password
   - JWT secret

2. **Enable HTTPS**
   - Use Let's Encrypt certificates
   - Force HTTPS redirects
   - Enable HSTS headers

3. **Firewall Configuration**
   ```bash
   # Allow SSH
   ufw allow 22/tcp

   # Allow HTTP/HTTPS
   ufw allow 80/tcp
   ufw allow 443/tcp

   # Enable firewall
   ufw enable
   ```

4. **Regular Updates**
   - Keep Docker images updated
   - Apply security patches
   - Monitor security advisories

5. **Access Control**
   - Use strong passwords
   - Enable MFA (if available)
   - Regular access audits
   - Review audit logs

### Troubleshooting

#### Services Won't Start

```bash
# Check Docker logs
docker-compose logs

# Check specific service
docker-compose logs backend-1

# Verify environment file
cat .env.production

# Check disk space
df -h

# Check memory
free -m
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
docker exec netmon-postgres pg_isready -U monitor_user

# Check PostgreSQL logs
docker-compose logs postgres

# Verify credentials
docker exec -it netmon-postgres psql -U monitor_user -d digiskills_monitor
```

#### High Memory Usage

```bash
# Check container stats
docker stats

# Restart specific service
docker-compose restart backend-1

# Check for memory leaks in logs
docker-compose logs backend-1 | grep -i memory
```

#### Slow Performance

```bash
# Check database performance
docker exec netmon-postgres psql -U monitor_user -d digiskills_monitor -c "
  SELECT query, calls, total_time, mean_time
  FROM pg_stat_statements
  ORDER BY total_time DESC
  LIMIT 10;
"

# Check Nginx access logs
docker-compose logs nginx | grep -E "[0-9]{3,}ms"

# Monitor system resources
htop
```

## File Structure

```
NetMon/
├── backend/
│   ├── Dockerfile                    # Backend container definition
│   └── .dockerignore                 # Ignore files for Docker build
├── frontend/
│   ├── Dockerfile                    # Frontend container definition
│   ├── .dockerignore                 # Ignore files for Docker build
│   └── nginx.conf                    # Nginx config for frontend
├── nginx/
│   ├── nginx.conf                    # Main Nginx configuration
│   ├── conf.d/
│   │   └── default.conf              # Site configuration
│   └── ssl/
│       ├── README.md                 # SSL setup guide
│       └── .gitignore                # Ignore certificates
├── scripts/
│   ├── deploy.sh                     # Main deployment script
│   ├── backup.sh                     # Database backup script
│   ├── restore.sh                    # Database restore script
│   └── monitor.sh                    # Health monitoring script
├── backups/                          # Database backups directory
├── docker-compose.yml                # Docker Compose orchestration
└── .env.production.example           # Production environment template
```

## Environment Variables Reference

See `.env.production.example` for complete list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Application environment | production |
| `PORT` | Backend port | 3000 |
| `DB_PASSWORD` | Database password | **CHANGE THIS** |
| `JWT_SECRET` | JWT signing secret | **CHANGE THIS** |
| `REDIS_PASSWORD` | Redis password | **CHANGE THIS** |
| `SMTP_HOST` | SMTP server | smtp.digiskills.local |
| `BACKUP_RETENTION_DAYS` | Backup retention | 30 |
| `ALERT_EVAL_INTERVAL` | Alert check interval (ms) | 60000 |

## Monitoring Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | Liveness probe | 200 if alive |
| `/ready` | Readiness probe | 200 if ready |
| `/api/health` | API health check | JSON health status |

## Support and Resources

### Documentation
- Docker: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- Nginx: https://nginx.org/en/docs/
- PostgreSQL: https://www.postgresql.org/docs/
- Let's Encrypt: https://letsencrypt.org/docs/

### Monitoring Tools
- Portainer: Docker GUI management
- Grafana: Metrics visualization
- Prometheus: Metrics collection
- ELK Stack: Log aggregation

### Community
- GitHub Issues: Report bugs and feature requests
- Documentation: Check README files
- Wiki: Detailed guides and tutorials

## Next Steps

After successful deployment:

1. **Configure Monitoring**
   - Set up external monitoring (UptimeRobot, Pingdom)
   - Configure alerting thresholds
   - Set up log aggregation

2. **Performance Baseline**
   - Run load tests
   - Establish performance baselines
   - Optimize as needed

3. **Documentation**
   - Document custom configurations
   - Create runbooks for common issues
   - Train team on deployment procedures

4. **Continuous Improvement**
   - Regular security audits
   - Performance optimization
   - Feature enhancements
   - User feedback integration

## Conclusion

Phase 8 provides a robust, production-ready deployment infrastructure with:
- ✅ Container orchestration with Docker Compose
- ✅ Load balancing with Nginx
- ✅ Automated backups and disaster recovery
- ✅ Health monitoring and alerting
- ✅ Security hardening
- ✅ Scalability and high availability
- ✅ Comprehensive automation scripts

The system is now ready for production deployment!
