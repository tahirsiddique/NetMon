#!/usr/bin/env node

/**
 * Monitoring Worker Entry Point
 * Starts the background monitoring worker that collects metrics from all devices
 */

require('dotenv').config();
const { scheduleMonitoring } = require('./monitoring-worker');

console.log('\n================================');
console.log('Digiskills Network Monitor');
console.log('Background Monitoring Worker');
console.log('================================\n');

// Start monitoring
scheduleMonitoring()
  .then(() => {
    console.log('Worker is running. Press Ctrl+C to stop.\n');
  })
  .catch((error) => {
    console.error('Failed to start monitoring worker:', error);
    process.exit(1);
  });

// Keep process alive
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
