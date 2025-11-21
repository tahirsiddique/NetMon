const alertRulesService = require('../services/alert-rules-service');
const emailNotificationService = require('../services/email-notification-service');
const { query } = require('../config/database');

/**
 * Alert Evaluation Worker
 *
 * Periodically evaluates all active alert rules and triggers notifications
 * when conditions are met.
 */

let evaluationInterval = null;
let isShuttingDown = false;
let evaluationCount = 0;
let totalTriggered = 0;
let totalResolved = 0;
let errorCount = 0;
let lastEvaluationTime = null;
let lastEvaluationResult = null;

// Evaluation interval in milliseconds (default: 1 minute)
const EVALUATION_INTERVAL_MS = parseInt(process.env.ALERT_EVAL_INTERVAL) || (60 * 1000);

/**
 * Perform alert rule evaluation
 */
async function performEvaluation() {
  if (isShuttingDown) {
    console.log('Evaluation skipped - worker is shutting down');
    return;
  }

  try {
    console.log(`\n[${new Date().toISOString()}] Starting alert evaluation #${evaluationCount + 1}...`);

    const startTime = Date.now();
    const result = await alertRulesService.evaluateAllRules();
    const duration = Date.now() - startTime;

    evaluationCount++;
    lastEvaluationTime = new Date();
    lastEvaluationResult = result;

    totalTriggered += result.triggered;
    totalResolved += result.resolved;
    errorCount += result.errors;

    console.log(`✓ Evaluation completed in ${duration}ms`);
    console.log(`  - Evaluated: ${result.evaluated} rules`);
    console.log(`  - Triggered: ${result.triggered} alerts`);
    console.log(`  - Resolved: ${result.resolved} alerts`);
    if (result.errors > 0) {
      console.log(`  - Errors: ${result.errors}`);
    }

    // Send notifications for newly triggered alerts
    if (result.triggered > 0) {
      await sendPendingNotifications();
    }

  } catch (error) {
    console.error('❌ Evaluation failed:', error.message);
    errorCount++;
  }
}

/**
 * Send email notifications for pending alerts
 */
async function sendPendingNotifications() {
  try {
    // Get alerts that need notifications
    const result = await query(`
      SELECT a.*, ar.name as rule_name, ar.description as rule_description,
             ar.severity, n.name as node_name
      FROM alerts a
      JOIN alert_rules ar ON a.rule_id = ar.id
      LEFT JOIN nodes n ON a.node_id = n.id
      WHERE a.triggered_at > NOW() - INTERVAL '2 minutes'
        AND a.resolved_at IS NULL
        AND a.id NOT IN (
          SELECT DISTINCT alert_id
          FROM alert_notifications
          WHERE status = 'sent'
        )
      ORDER BY a.triggered_at DESC
    `);

    if (result.rows.length === 0) {
      return;
    }

    console.log(`Sending notifications for ${result.rows.length} new alerts...`);

    for (const alert of result.rows) {
      try {
        const rule = {
          id: alert.rule_id,
          name: alert.rule_name,
          description: alert.rule_description,
          severity: alert.severity,
          node_name: alert.node_name,
          metric_type: alert.metric_type
        };

        await emailNotificationService.sendAlertNotification(alert, rule);
      } catch (error) {
        console.error(`Failed to send notification for alert ${alert.id}:`, error.message);
      }
    }

  } catch (error) {
    console.error('Failed to send pending notifications:', error);
  }
}

/**
 * Start the alert worker
 */
async function start() {
  console.log('\n========================================');
  console.log('🔔 Alert Evaluation Worker Starting');
  console.log('========================================');
  console.log(`Evaluation interval: ${EVALUATION_INTERVAL_MS / 1000}s`);
  console.log('========================================\n');

  // Initialize email service
  console.log('Initializing email notification service...');
  await emailNotificationService.initialize();

  // Perform initial evaluation
  await performEvaluation();

  // Schedule periodic evaluations
  evaluationInterval = setInterval(performEvaluation, EVALUATION_INTERVAL_MS);

  console.log(`\n✓ Alert worker started. Next evaluation in ${EVALUATION_INTERVAL_MS / 1000}s`);

  // Display statistics every 5 minutes
  setInterval(displayStats, 5 * 60 * 1000);
}

/**
 * Display evaluation statistics
 */
function displayStats() {
  console.log('\n--- Alert Evaluation Statistics ---');
  console.log(`Total evaluations: ${evaluationCount}`);
  console.log(`Total alerts triggered: ${totalTriggered}`);
  console.log(`Total alerts resolved: ${totalResolved}`);
  console.log(`Total errors: ${errorCount}`);
  console.log(`Last evaluation: ${lastEvaluationTime ? lastEvaluationTime.toISOString() : 'Never'}`);

  if (lastEvaluationResult) {
    console.log(`Last result: ${lastEvaluationResult.evaluated} evaluated, ${lastEvaluationResult.triggered} triggered, ${lastEvaluationResult.resolved} resolved`);
  }

  console.log('-----------------------------------\n');
}

/**
 * Stop the alert worker
 */
async function stop() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log('\n🛑 Stopping alert evaluation worker...');

  if (evaluationInterval) {
    clearInterval(evaluationInterval);
    evaluationInterval = null;
    console.log('✓ Evaluation interval cleared');
  }

  console.log(`✓ Worker stopped after ${evaluationCount} evaluations`);
  console.log(`  - Total triggered: ${totalTriggered}`);
  console.log(`  - Total resolved: ${totalResolved}`);
  console.log(`  - Total errors: ${errorCount}`);
}

/**
 * Graceful shutdown handlers
 */
process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  await stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received');
  await stop();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  errorCount++;
  // Don't exit on uncaught exceptions, just log them
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  errorCount++;
});

// Start the worker
if (require.main === module) {
  start().catch(error => {
    console.error('Failed to start alert worker:', error);
    process.exit(1);
  });
}

module.exports = { start, stop, performEvaluation };
