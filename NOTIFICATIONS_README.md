# Critical Alert Notifications: Email + WhatsApp

## Overview

The Digiskills Network Monitoring System includes an advanced notification system that sends critical alerts to administrators via **both Email and WhatsApp** when services fail or experience issues.

**Key Features:**
- 🔴 **Dual-Channel Notifications**: Email + WhatsApp for critical alerts
- ⚡ **Real-time Alerts**: Instant notifications on service failures
- 🎯 **Smart Routing**: Critical alerts sent to both channels, warnings to email only
- 📱 **Multiple Providers**: Support for Twilio, WhatsApp Cloud API, or custom webhooks
- 🔄 **Automatic Failover**: Falls back to email if WhatsApp fails
- 🧪 **Test Functionality**: Easy testing of notification channels

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Service Health Monitoring                      │
│  (monitor.sh runs every 5 minutes via cron)             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │  Detect Critical       │
          │  Service Failure       │
          └────────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Notification Service  │
        │  (notification.js)    │
        └──────┬───────┬────────┘
               │       │
       ┌───────┘       └───────┐
       ▼                       ▼
┌─────────────┐      ┌──────────────────┐
│Email Service│      │ WhatsApp Service │
│  (SMTP)     │      │ (Twilio/Cloud)   │
└──────┬──────┘      └────────┬─────────┘
       │                      │
       ▼                      ▼
  📧 Admin Email         📱 Admin WhatsApp
```

## Setup Guide

### Step 1: Choose WhatsApp Provider

You have three options:

#### Option 1: Twilio WhatsApp API (Recommended) ⭐

**Pros:**
- Easy setup and reliable
- 1,000 free messages/month
- Best documentation
- Production-ready

**Setup:**
1. Create Twilio account: https://www.twilio.com/try-twilio
2. Get WhatsApp Sandbox or production number
3. Note your Account SID and Auth Token
4. Configure in `.env.production`

```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_ADMIN_NUMBERS=+923001234567,+923009876543
```

#### Option 2: WhatsApp Business Cloud API

**Pros:**
- Official WhatsApp API
- Free tier available
- More features (templates, media)

**Cons:**
- More complex setup
- Requires Facebook Business verification

**Setup:**
1. Create Facebook Developer account
2. Create WhatsApp Business App
3. Get API token and Phone Number ID
4. Configure in `.env.production`

```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=cloud-api
WHATSAPP_CLOUD_API_TOKEN=EAAxxxxxxxxxxxxxxxx
WHATSAPP_CLOUD_API_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ADMIN_NUMBERS=+923001234567,+923009876543
```

#### Option 3: Custom Webhook

**Use Case:** If you have your own WhatsApp service

```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=webhook
WHATSAPP_WEBHOOK_URL=https://your-service.com/api/send
WHATSAPP_WEBHOOK_API_KEY=your_api_key
WHATSAPP_ADMIN_NUMBERS=+923001234567,+923009876543
```

### Step 2: Configure Admin Recipients

Add admin phone numbers (with country code):

```env
# Pakistan format: +92 followed by number without leading zero
WHATSAPP_ADMIN_NUMBERS=+923001234567,+923009876543,+923451234567

# Multiple admins receive all critical alerts
ADMIN_EMAIL=admin@digiskills.local,ops@digiskills.local
```

### Step 3: Enable Notifications

```env
# Enable WhatsApp notifications
WHATSAPP_ENABLED=true

# Email should already be configured
SMTP_HOST=smtp.digiskills.local
SMTP_PORT=587
SMTP_USER=monitor@digiskills.local
SMTP_PASS=your_email_password
```

### Step 4: Test Configuration

#### Test via API (Recommended)

```bash
# Get admin JWT token first
TOKEN="your_admin_jwt_token"

# Test both Email and WhatsApp
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer $TOKEN"

# Test Email only
curl -X POST http://localhost:3000/api/notifications/test/email \
  -H "Authorization: Bearer $TOKEN"

# Test WhatsApp only
curl -X POST http://localhost:3000/api/notifications/test/whatsapp \
  -H "Authorization: Bearer $TOKEN"

# Test critical alert (sends to both)
curl -X POST http://localhost:3000/api/notifications/test/critical \
  -H "Authorization: Bearer $TOKEN"
```

#### Test via Frontend

1. Login as admin
2. Navigate to Settings > Notifications
3. Click "Test Email Notifications"
4. Click "Test WhatsApp Notifications"
5. Check your email and WhatsApp

### Step 5: Automated Monitoring Setup

The monitoring script (`scripts/monitor.sh`) automatically sends alerts when:
- Critical services go down (postgres, backend, nginx)
- Health checks fail
- Database connection lost
- High resource usage (>95%)

**Setup Automated Monitoring (Cron):**

```bash
# Edit crontab
crontab -e

# Add this line to check every 5 minutes
*/5 * * * * /opt/netmon/scripts/monitor.sh

# Or for more verbose logging
*/5 * * * * /opt/netmon/scripts/monitor.sh >> /var/log/netmon-monitor.log 2>&1
```

**For API-based alerts, create monitoring API token:**

```bash
# Generate admin token and save it
echo "MONITORING_API_TOKEN=your_admin_token_here" >> .env.production

# Update monitor.sh to use this token
export MONITORING_API_TOKEN=your_admin_token_here
```

## Alert Types

### Critical Alerts (Email + WhatsApp)

Sent via both channels:
- ❌ Service completely down
- ❌ Database connection lost
- ❌ Backend API not responding
- ❌ Nginx proxy failure
- ❌ Health check failures
- ⚠️ Resource usage >95%

**Example WhatsApp Message:**
```
🔴 *CRITICAL: PostgreSQL Database Failure*

📋 Service: netmon-postgres
⚠️ Status: DOWN
📝 Details: Container is not running. Service is completely down.
🕐 Time: 1/20/2025, 2:30 PM

🏢 Digiskills Network Monitor
```

**Example Email:**
- HTML formatted with branding
- Color-coded by severity
- Detailed error information
- Action required section

### Warning Alerts (Email Only)

- ⚠️ High resource usage (80-94%)
- ⚠️ Service degraded performance
- ⚠️ Non-critical health check failures

### Info Alerts (Email Only)

- ℹ️ Service restarted
- ℹ️ Configuration changes
- ℹ️ Scheduled maintenance

## API Endpoints

### Get Notification Status

```bash
GET /api/notifications/status

Response:
{
  "success": true,
  "status": {
    "initialized": true,
    "email": {
      "enabled": true,
      "configured": true
    },
    "whatsapp": {
      "enabled": true,
      "provider": "twilio",
      "configured": true
    }
  }
}
```

### Send Custom Notification

```bash
POST /api/notifications/send
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "System Maintenance",
  "message": "Scheduled maintenance will begin in 30 minutes",
  "severity": "warning",
  "channels": ["email", "whatsapp"]
}
```

### Test Notifications

```bash
# Test all channels
POST /api/notifications/test

# Test email only
POST /api/notifications/test/email

# Test WhatsApp only
POST /api/notifications/test/whatsapp

# Test critical alert
POST /api/notifications/test/critical
```

## Twilio Setup (Detailed)

### Sandbox Setup (Testing)

1. **Create Twilio Account**
   - Go to https://www.twilio.com/try-twilio
   - Sign up (free trial with $15 credit)

2. **Access WhatsApp Sandbox**
   - Go to Console → Messaging → Try it out → Send a WhatsApp message
   - Join sandbox by sending code to Twilio number
   - Example: "join <your-code>" to +1 415 523 8886

3. **Get Credentials**
   ```
   Account SID: Found in Console Dashboard
   Auth Token: Found in Console Dashboard (click to reveal)
   WhatsApp Number: whatsapp:+14155238886
   ```

4. **Test in Sandbox**
   - Admins must join sandbox first
   - Send join code from their WhatsApp
   - Then they'll receive alerts

### Production Setup

1. **Request Access**
   - Apply for WhatsApp Business API access
   - Provide business verification
   - Get approved number

2. **Configure in Twilio**
   - WhatsApp → Senders → Add new sender
   - Submit required documents
   - Wait for approval (1-2 weeks)

3. **Update Configuration**
   ```env
   TWILIO_WHATSAPP_NUMBER=whatsapp:+92YOUR_NUMBER
   ```

## WhatsApp Cloud API Setup (Detailed)

### Prerequisites

- Facebook Business Account
- Verified business
- Facebook Developer Account

### Setup Steps

1. **Create Business App**
   - Go to https://developers.facebook.com/
   - Create new app → Business → WhatsApp
   - Name your app

2. **Setup WhatsApp Product**
   - Add WhatsApp product
   - Select business phone number or get test number
   - Generate access token

3. **Get Credentials**
   ```
   Access Token: Settings → WhatsApp → Access Tokens
   Phone Number ID: WhatsApp → Getting Started → Phone Number ID
   ```

4. **Configure Webhook (Optional)**
   - For receiving status updates
   - Set webhook URL: https://your-domain.com/whatsapp/webhook

5. **Send Test Message**
   ```bash
   curl -X POST \
     https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages \
     -H "Authorization: Bearer ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "messaging_product": "whatsapp",
       "to": "+923001234567",
       "type": "text",
       "text": {
         "body": "Test message from Digiskills Monitor"
       }
     }'
   ```

## Troubleshooting

### WhatsApp Not Working

**Check configuration:**
```bash
# View notification status
curl http://localhost:3000/api/notifications/status \
  -H "Authorization: Bearer $TOKEN"
```

**Common Issues:**

1. **"WhatsApp service not initialized"**
   - Check `WHATSAPP_ENABLED=true`
   - Verify credentials in `.env.production`
   - Restart backend: `docker-compose restart backend-1`

2. **"No admin numbers configured"**
   - Add `WHATSAPP_ADMIN_NUMBERS=+923001234567`
   - Include country code (+92 for Pakistan)
   - Restart backend

3. **Twilio "Not a valid phone number"**
   - Check format: `whatsapp:+923001234567`
   - Must include country code
   - For sandbox, admin must join first

4. **"Failed to send WhatsApp"**
   - Check Twilio console for errors
   - Verify account has credits
   - Check phone number is verified

### Email Not Working

**Test SMTP:**
```bash
curl -X POST http://localhost:3000/api/notifications/test/email \
  -H "Authorization: Bearer $TOKEN"
```

**Common Issues:**

1. **"Email service not initialized"**
   - Check SMTP settings in `.env.production`
   - Verify SMTP credentials
   - Test SMTP server: `telnet smtp.server.com 587`

2. **"Connection refused"**
   - Check SMTP_HOST and SMTP_PORT
   - Verify firewall allows outbound port 587
   - Try SMTP_SECURE=false for port 587

### Monitor Script Not Sending Alerts

1. **Check cron is running:**
   ```bash
   systemctl status cron
   crontab -l
   ```

2. **Check monitor logs:**
   ```bash
   tail -f /var/log/netmon-monitor.log
   ```

3. **Test manually:**
   ```bash
   ./scripts/monitor.sh
   ```

4. **Verify API token:**
   - Ensure `MONITORING_API_TOKEN` is set
   - Token should have admin privileges

## Security Best Practices

1. **Protect Credentials**
   ```bash
   chmod 600 .env.production
   ```

2. **Use Environment Variables**
   - Never commit credentials to git
   - Use `.env.production` for production
   - Keep `.env.example` generic

3. **Limit Phone Numbers**
   - Only add trusted admin numbers
   - Review recipient list regularly
   - Remove old admin numbers

4. **Rate Limiting**
   - Twilio has rate limits
   - Don't send too many test messages
   - Monitor usage in Twilio console

5. **Secure API Endpoints**
   - Notification endpoints require admin role
   - Use strong JWT secrets
   - Rotate tokens regularly

## Cost Considerations

### Twilio Pricing

- **Free Trial**: $15 credit
- **WhatsApp Messages**:
  - Outbound: $0.005 - $0.01 per message
  - Inbound: Free
- **1,000 messages/month**: ~$5-10

### WhatsApp Cloud API

- **Free Tier**: 1,000 messages/month
- **After free tier**: Similar to Twilio

### Recommendations

- Use for critical alerts only (automatic)
- Avoid sending tests frequently
- Monitor usage monthly
- Set up billing alerts

## Notification Message Templates

### Service Failure
```
🔴 *CRITICAL: Service Failure*

📋 Service: netmon-postgres
⚠️ Status: DOWN
📝 Details: Container stopped unexpectedly
🕐 Time: 1/20/2025, 2:30 PM

🏢 Digiskills Network Monitor
```

### Health Check Failure
```
⚠️ *Health Check Failed*

📋 Service: backend-1, postgres
⚠️ Status: UNHEALTHY
📝 Details: 2 service(s) not responding
🕐 Time: 1/20/2025, 2:30 PM

🏢 Digiskills Network Monitor
```

### High Resource Usage
```
📊 *High Disk Usage Alert*

📋 Service: System Resources
⚠️ Status: 96% (Threshold: 80%)
📝 Details: Disk usage critically high
🕐 Time: 1/20/2025, 2:30 PM

🏢 Digiskills Network Monitor
```

## Monitoring Dashboard

Access notification settings in the web interface:

1. Login as admin
2. Go to Settings → Notifications
3. View status of all channels
4. Test each channel
5. View notification history
6. Configure preferences

## FAQ

**Q: Do I need to use both Email and WhatsApp?**
A: WhatsApp is optional. Email works independently. WhatsApp provides faster mobile alerts for critical issues.

**Q: Can I use multiple WhatsApp numbers?**
A: Yes, add comma-separated numbers in `WHATSAPP_ADMIN_NUMBERS`.

**Q: What happens if WhatsApp fails?**
A: The system automatically falls back to email only.

**Q: How do I disable WhatsApp temporarily?**
A: Set `WHATSAPP_ENABLED=false` in `.env.production` and restart.

**Q: Can operators receive WhatsApp alerts?**
A: Currently only admins. This is by design for critical alerts.

**Q: How often are health checks run?**
A: Every 5 minutes via cron (configurable).

**Q: Can I customize alert messages?**
A: Yes, edit templates in `whatsapp-notification-service.js` and `notification-service.js`.

## Support

For issues with notifications:

1. Check logs: `docker-compose logs backend-1`
2. Test configuration: `POST /api/notifications/test`
3. Review this documentation
4. Check provider console (Twilio/Facebook)
5. Contact IT support

---

**Version**: 2.0.0
**Last Updated**: January 20, 2025
**Feature**: Critical Alert Notifications via Email + WhatsApp ✅
