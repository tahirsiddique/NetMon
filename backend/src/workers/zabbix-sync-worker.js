const zabbixIntegration = require('../services/integrations/zabbix-integration');

/**
 * Zabbix Sync Worker
 *
 * Periodically synchronizes internet link data from Zabbix to local database.
 * Runs every 5 minutes to keep link status and bandwidth data up-to-date.
 */

let syncInterval = null;
let isShuttingDown = false;
let syncCount = 0;
let errorCount = 0;
let lastSyncTime = null;
let lastSyncResult = null;

// Sync interval in milliseconds (default: 5 minutes)
const SYNC_INTERVAL_MS = parseInt(process.env.ZABBIX_SYNC_INTERVAL) || (5 * 60 * 1000);

/**
 * Perform Zabbix sync
 */
async function performSync() {
  if (isShuttingDown) {
    console.log('Sync skipped - worker is shutting down');
    return;
  }

  try {
    console.log(`\n[${new Date().toISOString()}] Starting Zabbix sync #${syncCount + 1}...`);

    const startTime = Date.now();
    const result = await zabbixIntegration.syncInternetLinks();
    const duration = Date.now() - startTime;

    syncCount++;
    lastSyncTime = new Date();
    lastSyncResult = result;

    console.log(`✓ Sync completed in ${duration}ms`);
    console.log(`  - Total links: ${result.total}`);
    console.log(`  - Synced: ${result.synced}`);
    console.log(`  - Errors: ${result.errors}`);

    if (result.errors > 0) {
      errorCount += result.errors;
    }

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    errorCount++;

    // If we get consistent errors, slow down the sync rate
    if (errorCount > 5) {
      console.log('⚠️  Multiple sync errors detected. Consider checking Zabbix configuration.');
    }
  }
}

/**
 * Start the sync worker
 */
async function start() {
  console.log('\n========================================');
  console.log('🔄 Zabbix Sync Worker Starting');
  console.log('========================================');
  console.log(`Sync interval: ${SYNC_INTERVAL_MS / 1000}s`);
  console.log(`Zabbix URL: ${process.env.ZABBIX_URL || 'http://localhost/zabbix/api_jsonrpc.php'}`);
  console.log('========================================\n');

  // Test connection first
  console.log('Testing Zabbix connection...');
  try {
    const testResult = await zabbixIntegration.testConnection();

    if (testResult.success) {
      console.log(`✓ Connected to ${testResult.message}`);
    } else {
      console.log('⚠️  Zabbix connection test failed:', testResult.error);
      console.log('Worker will continue to retry...');
    }
  } catch (error) {
    console.log('⚠️  Zabbix connection test failed:', error.message);
    console.log('Worker will continue to retry...');
  }

  // Perform initial sync
  await performSync();

  // Schedule periodic syncs
  syncInterval = setInterval(performSync, SYNC_INTERVAL_MS);

  console.log(`\n✓ Sync worker started. Next sync in ${SYNC_INTERVAL_MS / 1000}s`);

  // Display statistics every 30 seconds
  setInterval(displayStats, 30000);
}

/**
 * Display sync statistics
 */
function displayStats() {
  console.log('\n--- Zabbix Sync Statistics ---');
  console.log(`Total syncs: ${syncCount}`);
  console.log(`Total errors: ${errorCount}`);
  console.log(`Last sync: ${lastSyncTime ? lastSyncTime.toISOString() : 'Never'}`);

  if (lastSyncResult) {
    console.log(`Last result: ${lastSyncResult.synced}/${lastSyncResult.total} links synced`);
  }

  console.log('------------------------------\n');
}

/**
 * Stop the sync worker
 */
async function stop() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log('\n🛑 Stopping Zabbix sync worker...');

  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('✓ Sync interval cleared');
  }

  console.log(`✓ Worker stopped after ${syncCount} syncs (${errorCount} errors)`);
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
    console.error('Failed to start Zabbix sync worker:', error);
    process.exit(1);
  });
}

module.exports = { start, stop, performSync };
