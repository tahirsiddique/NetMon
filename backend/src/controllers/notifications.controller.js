/**
 * Notifications Controller
 *
 * Handles notification system testing and management
 */

const { getNotificationService } = require('../services/notification-service');
const { getWhatsAppService } = require('../services/whatsapp-notification-service');

/**
 * Test all notification channels
 */
async function testNotifications(req, res) {
  try {
    const notificationService = getNotificationService();

    // Initialize if not already initialized
    if (!notificationService.initialized) {
      await notificationService.initialize();
    }

    const results = await notificationService.testNotifications();

    res.json({
      success: true,
      message: 'Notification tests completed',
      results
    });
  } catch (error) {
    console.error('Notification test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test notifications',
      message: error.message
    });
  }
}

/**
 * Test email notification only
 */
async function testEmail(req, res) {
  try {
    const notificationService = getNotificationService();

    if (!notificationService.initialized) {
      await notificationService.initialize();
    }

    const result = await notificationService.sendCriticalEmail({
      title: '✅ Test Email Notification',
      service: 'Email Test',
      status: 'TESTING',
      message: 'This is a test email. If you received this, email notifications are working correctly.',
      severity: 'info',
      timestamp: new Date()
    });

    res.json({
      success: result.success,
      message: result.success
        ? 'Test email sent successfully'
        : 'Failed to send test email',
      result
    });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      message: error.message
    });
  }
}

/**
 * Test WhatsApp notification only
 */
async function testWhatsApp(req, res) {
  try {
    const whatsappService = getWhatsAppService();

    if (!whatsappService.initialized) {
      await whatsappService.initialize();
    }

    const result = await whatsappService.testConnection();

    res.json({
      success: result.success,
      message: result.message,
      provider: result.provider,
      result
    });
  } catch (error) {
    console.error('WhatsApp test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test WhatsApp',
      message: error.message
    });
  }
}

/**
 * Send test critical alert
 */
async function testCriticalAlert(req, res) {
  try {
    const notificationService = getNotificationService();

    if (!notificationService.initialized) {
      await notificationService.initialize();
    }

    const results = await notificationService.sendCriticalServiceFailure(
      'Test Service',
      'This is a test critical alert. No action is required.',
      {
        status: 'TESTING'
      }
    );

    const emailStatus = results.email.success ? '✅' : '❌';
    const whatsappStatus = results.whatsapp.success ? '✅' : '❌';

    res.json({
      success: results.email.success || results.whatsapp.success,
      message: `Test critical alert sent - Email: ${emailStatus} WhatsApp: ${whatsappStatus}`,
      results
    });
  } catch (error) {
    console.error('Critical alert test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test critical alert',
      message: error.message
    });
  }
}

/**
 * Get notification service status
 */
async function getStatus(req, res) {
  try {
    const notificationService = getNotificationService();
    const status = notificationService.getStatus();

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification status',
      message: error.message
    });
  }
}

/**
 * Send custom notification (admin only)
 */
async function sendCustomNotification(req, res) {
  try {
    const { title, message, severity = 'info', channels = ['email', 'whatsapp'] } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title and message'
      });
    }

    const notificationService = getNotificationService();

    if (!notificationService.initialized) {
      await notificationService.initialize();
    }

    const results = {};

    // Send email if requested
    if (channels.includes('email')) {
      results.email = await notificationService.sendCriticalEmail({
        title,
        message,
        severity,
        timestamp: new Date()
      });
    }

    // Send WhatsApp if requested
    if (channels.includes('whatsapp')) {
      const whatsappService = getWhatsAppService();
      if (whatsappService && whatsappService.enabled) {
        results.whatsapp = await whatsappService.sendCustomAlert(title, message, severity);
      }
    }

    res.json({
      success: true,
      message: 'Custom notification sent',
      results
    });
  } catch (error) {
    console.error('Custom notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send custom notification',
      message: error.message
    });
  }
}

module.exports = {
  testNotifications,
  testEmail,
  testWhatsApp,
  testCriticalAlert,
  getStatus,
  sendCustomNotification
};
