# Systemd Service Configuration

This directory contains systemd service files for running the Digiskills Network Monitoring System as a system service on Linux.

## Installation

### 1. Deploy the Application

First, ensure the application is deployed to `/opt/netmon`:

```bash
# Create deployment directory
sudo mkdir -p /opt/netmon

# Copy application files
sudo cp -r /path/to/NetMon/* /opt/netmon/

# Set permissions
sudo chown -R $USER:docker /opt/netmon
```

### 2. Install Systemd Service

```bash
# Copy service file to systemd directory
sudo cp systemd/netmon.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable netmon.service
```

### 3. Configure Environment

Ensure `.env.production` is configured in `/opt/netmon/`:

```bash
cd /opt/netmon
cp .env.production.example .env.production
sudo nano .env.production
```

## Usage

### Start the Service

```bash
sudo systemctl start netmon
```

### Stop the Service

```bash
sudo systemctl stop netmon
```

### Restart the Service

```bash
sudo systemctl restart netmon
```

### Check Status

```bash
sudo systemctl status netmon
```

### Enable Auto-start on Boot

```bash
sudo systemctl enable netmon
```

### Disable Auto-start

```bash
sudo systemctl disable netmon
```

### View Logs

```bash
# View service logs
sudo journalctl -u netmon -f

# View last 100 lines
sudo journalctl -u netmon -n 100

# View logs since boot
sudo journalctl -u netmon -b
```

## Service Management

### Check if Service is Running

```bash
sudo systemctl is-active netmon
```

### Check if Service is Enabled

```bash
sudo systemctl is-enabled netmon
```

### Reload Service Configuration

After modifying the service file:

```bash
sudo systemctl daemon-reload
sudo systemctl restart netmon
```

## Troubleshooting

### Service Won't Start

1. **Check service status**:
   ```bash
   sudo systemctl status netmon
   ```

2. **Check logs**:
   ```bash
   sudo journalctl -u netmon -n 50
   ```

3. **Verify Docker is running**:
   ```bash
   sudo systemctl status docker
   ```

4. **Check file permissions**:
   ```bash
   ls -la /opt/netmon
   ```

5. **Test manual start**:
   ```bash
   cd /opt/netmon
   docker-compose up -d
   ```

### Service Fails to Stop

```bash
# Force stop all containers
cd /opt/netmon
docker-compose down

# Then restart service
sudo systemctl restart netmon
```

### Permission Issues

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker

# Restart service
sudo systemctl restart netmon
```

## Advanced Configuration

### Custom Installation Path

If installing to a different path than `/opt/netmon`, edit the service file:

```bash
sudo nano /etc/systemd/system/netmon.service
```

Change the `WorkingDirectory` line:
```ini
WorkingDirectory=/your/custom/path
```

Then reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart netmon
```

### Email Notifications on Failure

Add email notification on service failure:

```bash
sudo nano /etc/systemd/system/netmon-failure@.service
```

```ini
[Unit]
Description=Netmon Failure Notification

[Service]
Type=oneshot
ExecStart=/usr/bin/mail -s "Netmon Service Failed" admin@digiskills.local < /tmp/netmon-failure.txt
```

Then modify `netmon.service`:
```ini
[Unit]
OnFailure=netmon-failure@%n.service
```

### Automatic Restart Policy

Modify the service file to configure automatic restarts:

```ini
[Service]
Restart=always
RestartSec=10s
StartLimitInterval=60s
StartLimitBurst=3
```

This will:
- Always restart on failure
- Wait 10 seconds before restarting
- Allow up to 3 restarts in 60 seconds

## Monitoring

### Service Status Dashboard

```bash
# Watch service status
watch -n 2 'systemctl status netmon'
```

### Integration with Monitoring Tools

```bash
# Add to monitoring script
if ! systemctl is-active --quiet netmon; then
    echo "Netmon service is not running!"
    # Send alert
fi
```

### Automated Health Checks

Create a timer for periodic health checks:

```bash
sudo nano /etc/systemd/system/netmon-health.service
```

```ini
[Unit]
Description=Netmon Health Check

[Service]
Type=oneshot
ExecStart=/opt/netmon/scripts/monitor.sh
User=root
```

```bash
sudo nano /etc/systemd/system/netmon-health.timer
```

```ini
[Unit]
Description=Run Netmon Health Check Every 5 Minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

Enable the timer:
```bash
sudo systemctl enable netmon-health.timer
sudo systemctl start netmon-health.timer
```

## Backup Integration

### Automated Backups with Systemd Timers

Create backup service:

```bash
sudo nano /etc/systemd/system/netmon-backup.service
```

```ini
[Unit]
Description=Netmon Database Backup

[Service]
Type=oneshot
WorkingDirectory=/opt/netmon
ExecStart=/usr/local/bin/docker-compose --profile backup run --rm backup
User=root
```

Create backup timer (daily at 2 AM):

```bash
sudo nano /etc/systemd/system/netmon-backup.timer
```

```ini
[Unit]
Description=Daily Netmon Backup

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl enable netmon-backup.timer
sudo systemctl start netmon-backup.timer

# Check timer status
systemctl list-timers netmon-backup.timer
```

## Uninstallation

To completely remove the service:

```bash
# Stop and disable service
sudo systemctl stop netmon
sudo systemctl disable netmon

# Remove service file
sudo rm /etc/systemd/system/netmon.service

# Reload systemd
sudo systemctl daemon-reload

# Optionally remove application
sudo rm -rf /opt/netmon
```

## Best Practices

1. **Always use systemctl** for service management instead of docker-compose directly
2. **Monitor logs** regularly with `journalctl`
3. **Set up automated backups** using systemd timers
4. **Configure email alerts** for service failures
5. **Test restart behavior** before relying on auto-restart
6. **Keep service files** in version control
7. **Document custom configurations** for your team

## Security Considerations

1. **Run as dedicated user** (not root) when possible
2. **Limit service permissions** using systemd security features
3. **Secure environment variables** in `/opt/netmon/.env.production`
4. **Regular security updates** of the host system
5. **Monitor service logs** for suspicious activity

## Resources

- [Systemd Documentation](https://www.freedesktop.org/wiki/Software/systemd/)
- [Systemd Service Management](https://www.digitalocean.com/community/tutorials/systemd-essentials-working-with-services-units-and-the-journal)
- [Systemd Timers](https://www.freedesktop.org/software/systemd/man/systemd.timer.html)
