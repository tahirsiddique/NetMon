# Local Deployment Guide - Ubuntu Server 24.04

Complete step-by-step guide to deploy the Digiskills Network Monitoring System on Ubuntu Server 24.04 LTS.

## Prerequisites

### System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 50 GB | 100+ GB (SSD preferred) |
| Network | 100 Mbps | 1 Gbps |

### Network Requirements

- Static IP address (or DHCP reservation)
- Access to monitored devices (SNMP, WMI)
- Outbound internet (for Docker images, updates)
- Open ports: 80, 443 (optional: 5432, 6379 for direct DB access)

---

## Step 1: Update System

```bash
# Update package lists and upgrade existing packages
sudo apt update && sudo apt upgrade -y

# Install basic utilities
sudo apt install -y curl wget git nano htop net-tools

# Reboot if kernel was updated
sudo reboot
```

---

## Step 2: Install Docker

```bash
# Remove old Docker versions (if any)
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null

# Install required packages
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (logout/login required)
sudo usermod -aG docker $USER

# Apply group changes without logout
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

## Step 3: Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/netmon
sudo chown $USER:$USER /opt/netmon

# Clone the repository
cd /opt/netmon
git clone https://github.com/tahirsiddique/NetMon.git .

# Or if using a different branch
# git clone -b main https://github.com/tahirsiddique/NetMon.git .

# Verify files
ls -la
```

---

## Step 4: Configure Environment

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit configuration
nano .env.production
```

### Essential Configuration Changes

```bash
# =============================================================================
# REQUIRED CHANGES - Update these values!
# =============================================================================

# Database - Use strong password
DB_PASSWORD=YourStrongDBPassword123!

# Redis - Use strong password
REDIS_PASSWORD=YourStrongRedisPassword456!

# JWT Secret - Generate a random string
# Run: openssl rand -base64 64
JWT_SECRET=YourVeryLongRandomSecretKeyHereGenerateWithOpenSSL

# Admin Email for alerts
ADMIN_EMAIL=admin@yourdomain.com

# =============================================================================
# SMTP Configuration (for email alerts)
# =============================================================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=NetMon <your-email@gmail.com>

# =============================================================================
# WhatsApp Configuration (optional but recommended)
# =============================================================================
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio
WHATSAPP_ADMIN_NUMBERS=+923001234567
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# =============================================================================
# Server URL (change to your server IP or domain)
# =============================================================================
FRONTEND_URL=http://192.168.1.100
```

### Generate JWT Secret

```bash
# Generate secure JWT secret
openssl rand -base64 64

# Copy the output and paste it as JWT_SECRET in .env.production
```

### Gmail SMTP Setup (if using Gmail)

1. Enable 2-Factor Authentication on Gmail
2. Go to Google Account → Security → App Passwords
3. Create new app password for "Mail"
4. Use that password as `SMTP_PASS`

---

## Step 5: Create Required Directories

```bash
cd /opt/netmon

# Create backup directory
mkdir -p backups

# Create SSL directory (for future HTTPS)
mkdir -p nginx/ssl

# Set permissions
chmod +x scripts/*.sh
```

---

## Step 6: Build and Deploy

### Option A: Using Deploy Script (Recommended)

```bash
cd /opt/netmon

# Run installation
./scripts/deploy.sh install
```

This will:
1. Check prerequisites
2. Build Docker images
3. Initialize database with migrations
4. Start all services
5. Display status

### Option B: Using Make

```bash
cd /opt/netmon

# Install
make install

# Or step by step
make build
make start
```

### Option C: Using Docker Compose Directly

```bash
cd /opt/netmon

# Build images
docker compose build

# Start services
docker compose up -d

# Wait for database to be ready (30 seconds)
sleep 30

# Run migrations
docker compose exec backend-1 node src/config/migrate.js

# Seed initial data (admin user)
docker compose exec backend-1 node src/config/seed.js
```

---

## Step 7: Verify Deployment

### Check Service Status

```bash
# View all containers
docker compose ps

# Expected output - all should be "Up" and "healthy"
# NAME                 STATUS
# netmon-postgres      Up (healthy)
# netmon-redis         Up (healthy)
# netmon-backend-1     Up (healthy)
# netmon-backend-2     Up (healthy)
# netmon-frontend      Up (healthy)
# netmon-nginx         Up (healthy)
# netmon-alert-worker  Up
```

### Check Health Endpoints

```bash
# Backend health
curl http://localhost/health

# Expected: {"status":"healthy","database":"connected",...}

# Backend readiness
curl http://localhost/ready

# Expected: {"status":"ready","checks":{"database":true,"server":true}}
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend-1

# Last 100 lines
docker compose logs --tail=100
```

### Access Web Interface

Open browser and navigate to:
```
http://YOUR_SERVER_IP
```

**Default Login Credentials:**
- **Username:** `admin`
- **Password:** `admin`

**⚠️ IMPORTANT:** Change the admin password immediately after first login!

---

## Step 8: Configure Firewall

```bash
# Install UFW if not present
sudo apt install -y ufw

# Allow SSH (important - don't lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS (for future SSL)
sudo ufw allow 443/tcp

# Optional: Allow direct database access (only if needed)
# sudo ufw allow 5432/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Step 9: Setup Systemd Service

Enable automatic startup on boot:

```bash
# Copy systemd service file
sudo cp /opt/netmon/systemd/netmon.service /etc/systemd/system/

# Update working directory in service file
sudo nano /etc/systemd/system/netmon.service
# Ensure WorkingDirectory=/opt/netmon

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable netmon

# Start service (if not already running)
sudo systemctl start netmon

# Check status
sudo systemctl status netmon
```

### Systemd Commands

```bash
# Start
sudo systemctl start netmon

# Stop
sudo systemctl stop netmon

# Restart
sudo systemctl restart netmon

# View logs
sudo journalctl -u netmon -f
```

---

## Step 10: Setup Automated Backups

```bash
# Edit crontab
crontab -e

# Add these lines:

# Daily backup at 2 AM
0 2 * * * cd /opt/netmon && docker compose --profile backup run --rm backup >> /var/log/netmon-backup.log 2>&1

# Health check every 5 minutes
*/5 * * * * /opt/netmon/scripts/monitor.sh >> /var/log/netmon-monitor.log 2>&1

# Weekly cleanup of old logs (Sundays at 3 AM)
0 3 * * 0 find /opt/netmon/backend/logs -name "*.log" -mtime +30 -delete

# Save and exit (Ctrl+X, Y, Enter in nano)
```

### Verify Cron Jobs

```bash
# List cron jobs
crontab -l

# Check cron service
sudo systemctl status cron
```

---

## Step 11: Setup SSL/HTTPS (Optional but Recommended)

### Option A: Let's Encrypt (Public Domain)

```bash
# Install certbot
sudo apt install -y certbot

# Stop nginx temporarily
docker compose stop nginx

# Get certificate
sudo certbot certonly --standalone -d monitor.yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/monitor.yourdomain.com/fullchain.pem /opt/netmon/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/monitor.yourdomain.com/privkey.pem /opt/netmon/nginx/ssl/key.pem
sudo chown $USER:$USER /opt/netmon/nginx/ssl/*.pem

# Update .env.production
echo "ENABLE_HTTPS=true" >> /opt/netmon/.env.production

# Edit nginx config to enable HTTPS
nano /opt/netmon/nginx/conf.d/default.conf
# Uncomment the HTTPS server block

# Restart nginx
docker compose restart nginx
```

### Option B: Self-Signed Certificate (Internal Use)

```bash
cd /opt/netmon/nginx/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/C=PK/ST=Punjab/L=Lahore/O=Digiskills/CN=netmon.local"

# Set permissions
chmod 600 key.pem
chmod 644 cert.pem
```

---

## Step 12: Test Everything

### Run Health Check

```bash
/opt/netmon/scripts/monitor.sh
```

### Test Email Notifications

```bash
# Get admin token (from browser developer tools after login)
TOKEN="your_jwt_token"

curl -X POST http://localhost:3000/api/notifications/test/email \
  -H "Authorization: Bearer $TOKEN"
```

### Test WhatsApp Notifications (if configured)

```bash
curl -X POST http://localhost:3000/api/notifications/test/whatsapp \
  -H "Authorization: Bearer $TOKEN"
```

### Test Backup

```bash
cd /opt/netmon
docker compose --profile backup run --rm backup

# Check backup file
ls -la backups/
```

---

## Quick Reference Commands

### Service Management

```bash
# Start all services
cd /opt/netmon && docker compose up -d

# Stop all services
cd /opt/netmon && docker compose down

# Restart all services
cd /opt/netmon && docker compose restart

# View status
cd /opt/netmon && docker compose ps

# View logs
cd /opt/netmon && docker compose logs -f
```

### Using Make

```bash
cd /opt/netmon

make start          # Start services
make stop           # Stop services
make restart        # Restart services
make status         # Show status
make logs           # View logs
make backup         # Run backup
make health         # Health check
```

### Using Deploy Script

```bash
cd /opt/netmon

./scripts/deploy.sh start
./scripts/deploy.sh stop
./scripts/deploy.sh restart
./scripts/deploy.sh status
./scripts/deploy.sh logs
./scripts/deploy.sh backup
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check Docker status
sudo systemctl status docker

# Check disk space
df -h

# Check memory
free -m

# View detailed logs
docker compose logs --tail=100
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Test connection
docker compose exec postgres psql -U monitor_user -d digiskills_monitor -c "SELECT 1"
```

### Cannot Access Web Interface

```bash
# Check nginx is running
docker compose ps nginx

# Check nginx logs
docker compose logs nginx

# Check firewall
sudo ufw status

# Test locally
curl http://localhost/
```

### Backend Errors

```bash
# Check backend logs
docker compose logs backend-1

# Check environment variables
docker compose exec backend-1 env | grep -E "DB_|REDIS_|JWT_"

# Restart backend
docker compose restart backend-1 backend-2
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker (remove unused images/containers)
docker system prune -a

# Clean old backups
find /opt/netmon/backups -name "*.sql.gz" -mtime +30 -delete
```

---

## Network Diagram

```
Internet/LAN
      │
      │ Port 80/443
      ▼
┌─────────────────────────────────────────────┐
│           Ubuntu Server 24.04               │
│                192.168.1.100                │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │           Docker Network              │  │
│  │                                       │  │
│  │  ┌─────────┐    ┌───────────────┐    │  │
│  │  │  Nginx  │───►│  Frontend     │    │  │
│  │  │  :80    │    │  (React)      │    │  │
│  │  └────┬────┘    └───────────────┘    │  │
│  │       │                               │  │
│  │       ▼                               │  │
│  │  ┌─────────┐    ┌─────────┐          │  │
│  │  │Backend-1│    │Backend-2│          │  │
│  │  │  :3000  │    │  :3000  │          │  │
│  │  └────┬────┘    └────┬────┘          │  │
│  │       │              │                │  │
│  │       └──────┬───────┘                │  │
│  │              │                        │  │
│  │       ┌──────┴───────┐               │  │
│  │       ▼              ▼               │  │
│  │  ┌─────────┐    ┌─────────┐          │  │
│  │  │PostgreSQL│    │  Redis  │          │  │
│  │  │  :5432  │    │  :6379  │          │  │
│  │  └─────────┘    └─────────┘          │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Post-Installation Checklist

- [ ] System updated (`apt update && apt upgrade`)
- [ ] Docker installed and running
- [ ] Repository cloned to `/opt/netmon`
- [ ] `.env.production` configured with strong passwords
- [ ] JWT secret generated and set
- [ ] SMTP configured for email alerts
- [ ] WhatsApp configured (optional)
- [ ] Services started and healthy
- [ ] Web interface accessible
- [ ] Admin password changed from default
- [ ] Firewall configured (UFW)
- [ ] Systemd service enabled
- [ ] Automated backups configured (cron)
- [ ] Health monitoring configured (cron)
- [ ] SSL/HTTPS enabled (optional)
- [ ] Tested email notifications
- [ ] Tested WhatsApp notifications (if configured)
- [ ] Test backup and restore procedure

---

## Support

For issues:
1. Check logs: `docker compose logs`
2. Run health check: `./scripts/monitor.sh`
3. Review documentation in repository
4. Check `NOTIFICATIONS_README.md` for alert issues
5. Check `PHASE8_README.md` for deployment details

---

**Deployment Complete!** 🎉

Your Digiskills Network Monitoring System is now running on Ubuntu Server 24.04!

Access at: `http://YOUR_SERVER_IP`

Default login: `admin` / `admin` (change immediately!)
