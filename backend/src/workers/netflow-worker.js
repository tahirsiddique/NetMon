#!/usr/bin/env node

/**
 * NetFlow Worker
 * Runs the NetFlow collector and processes internet usage data
 */

require('dotenv').config();
const NetFlowCollector = require('../services/collectors/netflow-collector');
const internetUsageService = require('../services/internet-usage-service');

console.log('\n================================');
console.log('Digiskills Network Monitor');
console.log('NetFlow Collector Worker');
console.log('================================\n');

// Initialize NetFlow collector
const port = parseInt(process.env.NETFLOW_PORT) || 2055;
const collector = new NetFlowCollector(port);

// Statistics tracking
let flowsProcessed = 0;
let lastStatsTime = Date.now();

// Handle flow events
collector.on('flow', async (flowData) => {
  try {
    await internetUsageService.recordUsage(flowData);
    flowsProcessed++;
  } catch (error) {
    console.error('Error recording flow:', error.message);
  }
});

// Handle listening event
collector.on('listening', (address) => {
  console.log(`NetFlow collector ready`);
  console.log(`Listening for NetFlow v5/v9 packets on UDP port ${address.port}`);
  console.log('');
  console.log('Configure your firewall to export NetFlow to this server:');
  console.log(`  FortiGate: config system netflow`);
  console.log(`    set collector-ip ${getLocalIP()}`);
  console.log(`    set collector-port ${address.port}`);
  console.log('');
  console.log('Press Ctrl+C to stop\n');
});

// Handle errors
collector.on('error', (error) => {
  console.error('NetFlow collector error:', error);
});

// Start the collector
collector.start();

// Display statistics every 30 seconds
setInterval(() => {
  const stats = collector.getStats();
  const now = Date.now();
  const elapsed = (now - lastStatsTime) / 1000;

  console.log('\n--- NetFlow Statistics ---');
  console.log(`Packets received: ${stats.packetsReceived}`);
  console.log(`Flows processed: ${stats.flowsProcessed}`);
  console.log(`Flows in cache: ${stats.cacheSize}`);
  console.log(`Templates loaded: ${stats.templatesLoaded}`);
  console.log(`Flows/sec: ${(flowsProcessed / elapsed).toFixed(2)}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Last received: ${stats.lastReceived ? stats.lastReceived.toLocaleTimeString() : 'Never'}`);
  console.log(`Buffer size: ${internetUsageService.aggregationBuffer.size} entries`);
  console.log('-------------------------\n');

  flowsProcessed = 0;
  lastStatsTime = now;
}, 30000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  await shutdown();
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  await shutdown();
});

async function shutdown() {
  console.log('Stopping NetFlow collector...');
  collector.stop();

  console.log('Flushing aggregation buffer...');
  await internetUsageService.flushBuffer();

  console.log('Stopping auto-flush...');
  internetUsageService.stopAutoFlush();

  console.log('✓ NetFlow worker stopped');
  process.exit(0);
}

// Helper function to get local IP
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return '0.0.0.0';
}

// Keep process alive
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
