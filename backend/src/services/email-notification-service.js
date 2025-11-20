const nodemailer = require('nodemailer');
const { query } = require('../config/database');

/**
 * Email Notification Service
 *
 * Sends email notifications for alerts, reports, and system events.
 */
class EmailNotificationService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.emailQueue = [];
    this.processing = false;
  }

  /**
   * Initialize email transporter
   */
  async initialize() {
    try {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT || 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.log('⚠️  SMTP credentials not configured. Email notifications disabled.');
        console.log('   Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable.');
        this.initialized = false;
        return false;
      }

      this.transporter = nodemailer.createTransporter({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates (development only)
        }
      });

      // Verify connection
      await this.transporter.verify();
      console.log('✓ Email service initialized');
      this.initialized = true;
      return true;

    } catch (error) {
      console.error('Failed to initialize email service:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Send alert notification
   */
  async sendAlertNotification(alert, rule) {
    if (!this.initialized) {
      console.log('Email service not initialized. Skipping notification.');
      return false;
    }

    try {
      // Get notification recipients
      const recipients = await this.getNotificationRecipients(rule.severity);

      if (recipients.length === 0) {
        console.log('No recipients configured for alert notifications');
        return false;
      }

      const subject = this.getAlertSubject(alert, rule);
      const html = this.getAlertEmailHTML(alert, rule);

      // Queue email for sending
      this.queueEmail({
        to: recipients.join(','),
        subject: subject,
        html: html,
        alertId: alert.id
      });

      return true;

    } catch (error) {
      console.error('Failed to send alert notification:', error);
      return false;
    }
  }

  /**
   * Get notification recipients based on severity
   */
  async getNotificationRecipients(severity) {
    try {
      // Get users with email notifications enabled
      const result = await query(`
        SELECT email
        FROM users
        WHERE email IS NOT NULL
          AND email_notifications = true
          AND (
            notification_severity = 'all'
            OR (notification_severity = 'critical' AND $1 = 'critical')
            OR (notification_severity = 'warning' AND $1 IN ('critical', 'warning'))
          )
      `, [severity]);

      // Return array of email addresses
      const emails = result.rows.map(row => row.email).filter(Boolean);

      // If no users configured, use admin email from env
      if (emails.length === 0 && process.env.ADMIN_EMAIL) {
        return [process.env.ADMIN_EMAIL];
      }

      return emails;

    } catch (error) {
      console.error('Failed to get notification recipients:', error);
      // Fallback to admin email
      return process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : [];
    }
  }

  /**
   * Get alert email subject
   */
  getAlertSubject(alert, rule) {
    const severityEmoji = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const emoji = severityEmoji[alert.severity] || '📢';
    return `${emoji} [${alert.severity.toUpperCase()}] ${rule.node_name || 'System'} - ${rule.metric_type.replace(/_/g, ' ')}`;
  }

  /**
   * Get alert email HTML content
   */
  getAlertEmailHTML(alert, rule) {
    const severityColor = {
      critical: '#DC2626',
      warning: '#F59E0B',
      info: '#3B82F6'
    };

    const color = severityColor[alert.severity] || '#6B7280';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Alert Triggered</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">${new Date(alert.triggered_at).toLocaleString()}</p>
  </div>

  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">

    <div style="background: white; padding: 20px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid ${color};">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111;">Alert Details</h2>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 40%;">Severity</td>
          <td style="padding: 8px 0; font-weight: 600; text-transform: uppercase; color: ${color};">${alert.severity}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Node</td>
          <td style="padding: 8px 0; font-weight: 500;">${rule.node_name || 'Unknown'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Metric Type</td>
          <td style="padding: 8px 0; font-weight: 500;">${rule.metric_type.replace(/_/g, ' ')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Current Value</td>
          <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${alert.current_value}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Threshold</td>
          <td style="padding: 8px 0; font-weight: 500;">${alert.threshold_value}</td>
        </tr>
      </table>
    </div>

    <div style="background: white; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #111;">Message</h3>
      <p style="margin: 0; color: #374151;">${alert.message}</p>
    </div>

    ${rule.description ? `
    <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Rule Description:</strong> ${rule.description}</p>
    </div>
    ` : ''}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <a href="${process.env.APP_URL || 'http://localhost:3000'}/alerts"
         style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        View in Dashboard
      </a>
    </div>

  </div>

  <div style="margin-top: 30px; padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
    <p style="margin: 0 0 5px 0;">Digiskills Network Monitoring System</p>
    <p style="margin: 0;">This is an automated alert notification.</p>
  </div>

</body>
</html>
    `;
  }

  /**
   * Queue email for sending
   */
  queueEmail(emailData) {
    this.emailQueue.push(emailData);

    // Process queue if not already processing
    if (!this.processing) {
      this.processEmailQueue();
    }
  }

  /**
   * Process email queue
   */
  async processEmailQueue() {
    if (this.processing || this.emailQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.emailQueue.length > 0) {
      const emailData = this.emailQueue.shift();

      try {
        await this.sendEmail(emailData);
        console.log(`✓ Email sent to ${emailData.to}`);

        // Log email notification
        if (emailData.alertId) {
          await this.logEmailNotification(emailData.alertId, emailData.to, 'sent');
        }

      } catch (error) {
        console.error(`Failed to send email to ${emailData.to}:`, error.message);

        // Log failure
        if (emailData.alertId) {
          await this.logEmailNotification(emailData.alertId, emailData.to, 'failed', error.message);
        }
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.processing = false;
  }

  /**
   * Send email
   */
  async sendEmail(emailData) {
    if (!this.initialized || !this.transporter) {
      throw new Error('Email service not initialized');
    }

    const mailOptions = {
      from: `"Digiskills Monitor" <${process.env.SMTP_USER}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html
    };

    const info = await this.transporter.sendMail(mailOptions);
    return info;
  }

  /**
   * Log email notification
   */
  async logEmailNotification(alertId, recipients, status, errorMessage = null) {
    try {
      await query(`
        INSERT INTO alert_notifications (
          alert_id,
          notification_type,
          recipient,
          status,
          error_message,
          sent_at
        ) VALUES ($1, 'email', $2, $3, $4, NOW())
      `, [alertId, recipients, status, errorMessage]);
    } catch (error) {
      console.error('Failed to log email notification:', error);
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(recipient) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized) {
      throw new Error('Email service not initialized. Check SMTP configuration.');
    }

    const testEmail = {
      to: recipient,
      subject: '✅ Test Email - Digiskills Network Monitor',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Email Configuration Test</h1>
  </div>

  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">

    <div style="background: white; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111;">✓ Success!</h2>
      <p style="margin: 0; color: #374151;">Your email notifications are configured correctly and working.</p>
    </div>

    <div style="background: #eff6ff; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; color: #1e40af; font-size: 14px;">
        <strong>SMTP Server:</strong> ${process.env.SMTP_HOST}<br>
        <strong>Time:</strong> ${new Date().toLocaleString()}
      </p>
    </div>

  </div>

  <div style="margin-top: 30px; padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
    <p style="margin: 0;">Digiskills Network Monitoring System</p>
  </div>

</body>
</html>
      `
    };

    await this.sendEmail(testEmail);
    return true;
  }
}

// Singleton instance
const emailNotificationService = new EmailNotificationService();

module.exports = emailNotificationService;
