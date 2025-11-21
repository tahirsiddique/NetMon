/**
 * WhatsApp Notification Service
 *
 * Sends WhatsApp notifications for critical alerts using multiple providers:
 * - Twilio WhatsApp API (recommended)
 * - WhatsApp Business Cloud API
 * - Custom webhook integration
 */

const axios = require('axios');

class WhatsAppNotificationService {
  constructor() {
    this.provider = process.env.WHATSAPP_PROVIDER || 'twilio'; // twilio, cloud-api, webhook
    this.enabled = process.env.WHATSAPP_ENABLED === 'true';

    // Twilio configuration
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g., whatsapp:+14155238886

    // WhatsApp Cloud API configuration
    this.cloudApiToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
    this.cloudApiPhoneNumberId = process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID;

    // Custom webhook configuration
    this.webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    this.webhookApiKey = process.env.WHATSAPP_WEBHOOK_API_KEY;

    // Admin recipients
    this.adminNumbers = this.parsePhoneNumbers(process.env.WHATSAPP_ADMIN_NUMBERS);

    this.initialized = false;
  }

  /**
   * Parse comma-separated phone numbers
   */
  parsePhoneNumbers(numbers) {
    if (!numbers) return [];
    return numbers.split(',').map(num => num.trim()).filter(num => num.length > 0);
  }

  /**
   * Initialize the WhatsApp service
   */
  async initialize() {
    if (!this.enabled) {
      console.log('WhatsApp notifications are disabled');
      return false;
    }

    if (this.adminNumbers.length === 0) {
      console.warn('No admin WhatsApp numbers configured');
      return false;
    }

    try {
      // Test connection based on provider
      if (this.provider === 'twilio') {
        if (!this.twilioAccountSid || !this.twilioAuthToken) {
          throw new Error('Twilio credentials not configured');
        }
        console.log('WhatsApp notifications initialized (Twilio)');
      } else if (this.provider === 'cloud-api') {
        if (!this.cloudApiToken || !this.cloudApiPhoneNumberId) {
          throw new Error('WhatsApp Cloud API credentials not configured');
        }
        console.log('WhatsApp notifications initialized (Cloud API)');
      } else if (this.provider === 'webhook') {
        if (!this.webhookUrl) {
          throw new Error('WhatsApp webhook URL not configured');
        }
        console.log('WhatsApp notifications initialized (Webhook)');
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize WhatsApp service:', error.message);
      return false;
    }
  }

  /**
   * Send WhatsApp message using Twilio
   */
  async sendViaTwilio(to, message) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;

      const formData = new URLSearchParams();
      formData.append('From', this.twilioWhatsAppNumber);
      formData.append('To', `whatsapp:${to}`);
      formData.append('Body', message);

      const response = await axios.post(url, formData, {
        auth: {
          username: this.twilioAccountSid,
          password: this.twilioAuthToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        success: true,
        messageId: response.data.sid,
        provider: 'twilio'
      };
    } catch (error) {
      console.error('Twilio WhatsApp error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send WhatsApp message using Cloud API
   */
  async sendViaCloudAPI(to, message) {
    try {
      const url = `https://graph.facebook.com/v18.0/${this.cloudApiPhoneNumberId}/messages`;

      const response = await axios.post(url, {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.cloudApiToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        messageId: response.data.messages[0].id,
        provider: 'cloud-api'
      };
    } catch (error) {
      console.error('WhatsApp Cloud API error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send WhatsApp message using custom webhook
   */
  async sendViaWebhook(to, message) {
    try {
      const response = await axios.post(this.webhookUrl, {
        to: to,
        message: message
      }, {
        headers: {
          'Authorization': `Bearer ${this.webhookApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        messageId: response.data.messageId || 'webhook-sent',
        provider: 'webhook'
      };
    } catch (error) {
      console.error('WhatsApp webhook error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send WhatsApp message to a single recipient
   */
  async sendMessage(to, message) {
    if (!this.enabled || !this.initialized) {
      console.log('WhatsApp service not enabled or initialized');
      return { success: false, reason: 'not_initialized' };
    }

    try {
      let result;

      switch (this.provider) {
        case 'twilio':
          result = await this.sendViaTwilio(to, message);
          break;
        case 'cloud-api':
          result = await this.sendViaCloudAPI(to, message);
          break;
        case 'webhook':
          result = await this.sendViaWebhook(to, message);
          break;
        default:
          throw new Error(`Unknown WhatsApp provider: ${this.provider}`);
      }

      console.log(`WhatsApp sent to ${to} via ${this.provider}: ${result.messageId}`);
      return result;
    } catch (error) {
      console.error(`Failed to send WhatsApp to ${to}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send critical alert notification
   */
  async sendCriticalAlert(alertData) {
    if (!this.enabled || !this.initialized) {
      return { success: false, reason: 'not_initialized' };
    }

    const message = this.formatCriticalAlert(alertData);
    const results = [];

    for (const number of this.adminNumbers) {
      const result = await this.sendMessage(number, message);
      results.push({
        number,
        ...result
      });
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`WhatsApp alerts sent: ${successCount}/${this.adminNumbers.length}`);

    return {
      success: successCount > 0,
      results,
      total: this.adminNumbers.length,
      successful: successCount
    };
  }

  /**
   * Format critical alert message
   */
  formatCriticalAlert(alertData) {
    const {
      title = 'Critical Alert',
      service,
      status,
      message,
      severity = 'critical',
      timestamp = new Date()
    } = alertData;

    const emoji = this.getSeverityEmoji(severity);
    const time = new Date(timestamp).toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    let text = `${emoji} *${title}*\n\n`;

    if (service) {
      text += `📋 Service: ${service}\n`;
    }

    if (status) {
      text += `⚠️ Status: ${status}\n`;
    }

    if (message) {
      text += `📝 Details: ${message}\n`;
    }

    text += `🕐 Time: ${time}\n`;
    text += `\n🏢 Digiskills Network Monitor`;

    return text;
  }

  /**
   * Send service failure notification
   */
  async sendServiceFailure(serviceName, error) {
    return this.sendCriticalAlert({
      title: '🚨 Service Failure Alert',
      service: serviceName,
      status: 'DOWN',
      message: error,
      severity: 'critical'
    });
  }

  /**
   * Send health check failure notification
   */
  async sendHealthCheckFailure(checks) {
    const failedServices = Object.entries(checks)
      .filter(([_, status]) => !status)
      .map(([service]) => service);

    return this.sendCriticalAlert({
      title: '⚠️ Health Check Failed',
      service: failedServices.join(', '),
      status: 'UNHEALTHY',
      message: `${failedServices.length} service(s) are not responding`,
      severity: 'critical'
    });
  }

  /**
   * Send database connection failure
   */
  async sendDatabaseFailure(error) {
    return this.sendCriticalAlert({
      title: '💾 Database Connection Lost',
      service: 'PostgreSQL',
      status: 'DISCONNECTED',
      message: error,
      severity: 'critical'
    });
  }

  /**
   * Send high resource usage alert
   */
  async sendResourceAlert(resource, usage, threshold) {
    return this.sendCriticalAlert({
      title: '📊 High Resource Usage',
      service: resource,
      status: `${usage}% (Threshold: ${threshold}%)`,
      message: `${resource} usage is critically high`,
      severity: 'warning'
    });
  }

  /**
   * Send custom alert
   */
  async sendCustomAlert(title, message, severity = 'info') {
    return this.sendCriticalAlert({
      title,
      message,
      severity
    });
  }

  /**
   * Get emoji for severity level
   */
  getSeverityEmoji(severity) {
    const emojis = {
      critical: '🔴',
      error: '🟠',
      warning: '🟡',
      info: '🔵'
    };
    return emojis[severity] || '⚪';
  }

  /**
   * Test WhatsApp connectivity
   */
  async testConnection() {
    if (!this.enabled) {
      return {
        success: false,
        message: 'WhatsApp notifications are disabled'
      };
    }

    if (this.adminNumbers.length === 0) {
      return {
        success: false,
        message: 'No admin numbers configured'
      };
    }

    try {
      const testMessage = `✅ WhatsApp Test Message\n\nThis is a test from Digiskills Network Monitor.\n\nTime: ${new Date().toLocaleString()}\n\nIf you received this, notifications are working!`;

      const result = await this.sendMessage(this.adminNumbers[0], testMessage);

      return {
        success: result.success,
        message: result.success
          ? `Test message sent successfully to ${this.adminNumbers[0]}`
          : `Failed to send test message: ${result.error}`,
        provider: this.provider
      };
    } catch (error) {
      return {
        success: false,
        message: `Test failed: ${error.message}`
      };
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get WhatsApp service instance
 */
function getWhatsAppService() {
  if (!instance) {
    instance = new WhatsAppNotificationService();
  }
  return instance;
}

module.exports = {
  WhatsAppNotificationService,
  getWhatsAppService
};
