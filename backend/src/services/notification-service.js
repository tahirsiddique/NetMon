/**
 * Unified Notification Service
 *
 * Sends notifications via multiple channels:
 * - Email (SMTP)
 * - WhatsApp (Twilio/Cloud API/Webhook)
 *
 * Handles critical alerts and service failures
 */

const { getWhatsAppService } = require('./whatsapp-notification-service');
const emailNotificationService = require('./email-notification-service');

class NotificationService {
  constructor() {
    this.whatsappService = null;
    this.emailService = emailNotificationService;
    this.initialized = false;
  }

  /**
   * Initialize all notification services
   */
  async initialize() {
    try {
      // Initialize WhatsApp service
      this.whatsappService = getWhatsAppService();
      await this.whatsappService.initialize();

      // Initialize Email service
      if (this.emailService && typeof this.emailService.initialize === 'function') {
        await this.emailService.initialize();
      }

      this.initialized = true;
      console.log('✅ Notification service initialized (Email + WhatsApp)');
      return true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  /**
   * Send critical service failure alert
   */
  async sendCriticalServiceFailure(serviceName, error, additionalDetails = {}) {
    const results = {
      email: { success: false },
      whatsapp: { success: false }
    };

    try {
      // Prepare alert data
      const alertData = {
        title: `🚨 CRITICAL: ${serviceName} Service Failure`,
        service: serviceName,
        status: 'DOWN',
        message: error,
        severity: 'critical',
        timestamp: new Date(),
        ...additionalDetails
      };

      // Send Email
      try {
        if (this.emailService) {
          const emailResult = await this.sendCriticalEmail(alertData);
          results.email = emailResult;
        }
      } catch (emailError) {
        console.error('Email notification failed:', emailError.message);
        results.email = { success: false, error: emailError.message };
      }

      // Send WhatsApp
      try {
        if (this.whatsappService && this.whatsappService.enabled) {
          const whatsappResult = await this.whatsappService.sendServiceFailure(
            serviceName,
            error
          );
          results.whatsapp = whatsappResult;
        }
      } catch (whatsappError) {
        console.error('WhatsApp notification failed:', whatsappError.message);
        results.whatsapp = { success: false, error: whatsappError.message };
      }

      // Log results
      const emailStatus = results.email.success ? '✅' : '❌';
      const whatsappStatus = results.whatsapp.success ? '✅' : '❌';
      console.log(`Critical alert sent - Email: ${emailStatus} WhatsApp: ${whatsappStatus}`);

      return results;
    } catch (error) {
      console.error('Failed to send critical service failure:', error);
      return results;
    }
  }

  /**
   * Send critical email notification
   */
  async sendCriticalEmail(alertData) {
    const {
      title,
      service,
      status,
      message,
      timestamp,
      severity = 'critical'
    } = alertData;

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('No admin email configured');
      return { success: false, reason: 'no_admin_email' };
    }

    const severityColor = {
      critical: '#dc2626',
      error: '#ea580c',
      warning: '#eab308',
      info: '#3b82f6'
    }[severity] || '#6b7280';

    const severityLabel = {
      critical: 'CRITICAL',
      error: 'ERROR',
      warning: 'WARNING',
      info: 'INFO'
    }[severity] || 'ALERT';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 32px; background-color: ${severityColor}; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                      ${title}
                    </h1>
                  </td>
                </tr>

                <!-- Alert Badge -->
                <tr>
                  <td style="padding: 24px 32px;">
                    <div style="display: inline-block; padding: 8px 16px; background-color: ${severityColor}; color: #ffffff; border-radius: 4px; font-weight: bold; font-size: 14px;">
                      ${severityLabel}
                    </div>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <table style="width: 100%; border-collapse: collapse;">
                      ${service ? `
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong>Service:</strong>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          ${service}
                        </td>
                      </tr>
                      ` : ''}

                      ${status ? `
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong>Status:</strong>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${severityColor}; font-weight: bold;">
                          ${status}
                        </td>
                      </tr>
                      ` : ''}

                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong>Time:</strong>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          ${new Date(timestamp).toLocaleString()}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Error Message -->
                ${message ? `
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <div style="background-color: #fef2f2; border-left: 4px solid ${severityColor}; padding: 16px; border-radius: 4px;">
                      <strong style="color: ${severityColor};">Error Details:</strong>
                      <p style="margin: 8px 0 0 0; color: #374151;">
                        ${message}
                      </p>
                    </div>
                  </td>
                </tr>
                ` : ''}

                <!-- Action Required -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <div style="background-color: #fffbeb; border: 1px solid #fbbf24; padding: 16px; border-radius: 4px;">
                      <strong style="color: #92400e;">⚠️ Immediate Action Required</strong>
                      <p style="margin: 8px 0 0 0; color: #92400e;">
                        Please investigate and resolve this issue immediately. The system may be experiencing downtime or degraded performance.
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      <strong>Digiskills Network Monitoring System</strong><br>
                      Automated Alert System
                    </p>
                    <p style="margin: 12px 0 0 0; color: #9ca3af; font-size: 12px;">
                      This is an automated alert. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      if (!this.emailService || !this.emailService.transporter) {
        console.warn('Email service not initialized');
        return { success: false, reason: 'email_not_initialized' };
      }

      await this.emailService.transporter.sendMail({
        from: process.env.SMTP_FROM || 'Digiskills Monitor <monitor@digiskills.local>',
        to: adminEmail,
        subject: `🚨 ${severityLabel}: ${service || 'System'} - ${status || 'Alert'}`,
        html: htmlContent
      });

      console.log(`✅ Critical email sent to ${adminEmail}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to send critical email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send health check failure notification
   */
  async sendHealthCheckFailure(failedChecks) {
    const results = {
      email: { success: false },
      whatsapp: { success: false }
    };

    try {
      const failedServices = Object.entries(failedChecks)
        .filter(([_, status]) => !status)
        .map(([service]) => service);

      const alertData = {
        title: '⚠️ Health Check Failed',
        service: failedServices.join(', '),
        status: 'UNHEALTHY',
        message: `${failedServices.length} service(s) are not responding: ${failedServices.join(', ')}`,
        severity: 'critical',
        timestamp: new Date()
      };

      // Send Email
      try {
        const emailResult = await this.sendCriticalEmail(alertData);
        results.email = emailResult;
      } catch (error) {
        results.email = { success: false, error: error.message };
      }

      // Send WhatsApp
      try {
        if (this.whatsappService && this.whatsappService.enabled) {
          const whatsappResult = await this.whatsappService.sendHealthCheckFailure(failedChecks);
          results.whatsapp = whatsappResult;
        }
      } catch (error) {
        results.whatsapp = { success: false, error: error.message };
      }

      return results;
    } catch (error) {
      console.error('Failed to send health check failure:', error);
      return results;
    }
  }

  /**
   * Send database connection failure
   */
  async sendDatabaseFailure(error) {
    return this.sendCriticalServiceFailure('PostgreSQL Database', error, {
      status: 'CONNECTION_LOST'
    });
  }

  /**
   * Send high resource usage alert
   */
  async sendResourceAlert(resource, usage, threshold) {
    const alertData = {
      title: `📊 High ${resource} Usage Alert`,
      service: 'System Resources',
      status: `${usage}% (Threshold: ${threshold}%)`,
      message: `${resource} usage has exceeded the threshold. Current: ${usage}%, Threshold: ${threshold}%`,
      severity: usage >= 95 ? 'critical' : 'warning',
      timestamp: new Date()
    };

    const results = {
      email: { success: false },
      whatsapp: { success: false }
    };

    try {
      // Send Email
      const emailResult = await this.sendCriticalEmail(alertData);
      results.email = emailResult;

      // Send WhatsApp (only for critical)
      if (this.whatsappService && this.whatsappService.enabled && usage >= 95) {
        const whatsappResult = await this.whatsappService.sendResourceAlert(
          resource,
          usage,
          threshold
        );
        results.whatsapp = whatsappResult;
      }

      return results;
    } catch (error) {
      console.error('Failed to send resource alert:', error);
      return results;
    }
  }

  /**
   * Test all notification channels
   */
  async testNotifications() {
    const results = {
      email: { success: false },
      whatsapp: { success: false }
    };

    console.log('🧪 Testing notification channels...');

    // Test Email
    try {
      const emailResult = await this.sendCriticalEmail({
        title: '✅ Test Email Notification',
        service: 'Notification System',
        status: 'TESTING',
        message: 'This is a test email from the Digiskills Network Monitor. If you received this, email notifications are working correctly.',
        severity: 'info',
        timestamp: new Date()
      });
      results.email = emailResult;
      console.log('Email test:', emailResult.success ? '✅ Success' : '❌ Failed');
    } catch (error) {
      console.log('Email test: ❌ Failed -', error.message);
      results.email = { success: false, error: error.message };
    }

    // Test WhatsApp
    try {
      if (this.whatsappService) {
        const whatsappResult = await this.whatsappService.testConnection();
        results.whatsapp = whatsappResult;
        console.log('WhatsApp test:', whatsappResult.success ? '✅ Success' : '❌ Failed');
      } else {
        console.log('WhatsApp test: ⚠️ Not configured');
      }
    } catch (error) {
      console.log('WhatsApp test: ❌ Failed -', error.message);
      results.whatsapp = { success: false, error: error.message };
    }

    return results;
  }

  /**
   * Get notification service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      email: {
        enabled: this.emailService && this.emailService.transporter != null,
        configured: process.env.SMTP_HOST != null
      },
      whatsapp: {
        enabled: this.whatsappService && this.whatsappService.enabled,
        provider: this.whatsappService ? this.whatsappService.provider : null,
        configured: this.whatsappService && this.whatsappService.initialized
      }
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get notification service instance
 */
function getNotificationService() {
  if (!instance) {
    instance = new NotificationService();
  }
  return instance;
}

module.exports = {
  NotificationService,
  getNotificationService
};
