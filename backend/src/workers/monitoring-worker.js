const Queue = require('bull');
const SNMPCollector = require('../services/collectors/snmp-collector');
const WMICollector = require('../services/collectors/wmi-collector');
const metricsService = require('../services/metrics-service');
const { query } = require('../config/database');

// Initialize collectors
const snmpCollector = new SNMPCollector();
const wmiCollector = new WMICollector();

// Create monitoring queue
const monitoringQueue = new Queue('monitoring', {
  redis: {
    host: process.env.REDIS_URL?.split('://')[1]?.split(':')[0] || 'localhost',
    port: parseInt(process.env.REDIS_URL?.split(':')[2]) || 6379
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500      // Keep last 500 failed jobs
  }
});

/**
 * Process monitoring jobs for individual devices
 */
monitoringQueue.process('collect-device-metrics', async (job) => {
  const { device } = job.data;

  console.log(`[${new Date().toISOString()}] Collecting metrics for: ${device.name} (${device.type})`);

  try {
    let result;

    // Determine collection method based on device type
    if (['dell_server', 'dell_switch', 'fortigate', 'pfsense', 'esxi', 'storage'].includes(device.type)) {
      // Use SNMP for network devices and servers with SNMP enabled
      result = await snmpCollector.collectDeviceMetrics(device);
    } else if (['windows_server', 'windows_client'].includes(device.type)) {
      // Use WMI for Windows systems
      result = await wmiCollector.collectWindowsMetrics(device);
    } else {
      // Try SNMP for unknown device types
      result = await snmpCollector.collectDeviceMetrics(device);
    }

    if (result.success) {
      // Save metrics to database
      await metricsService.saveMetrics(device.id, result);

      // Update node status to 'up'
      await metricsService.updateNodeStatus(device.id, 'up', new Date());

      console.log(`✓ Successfully collected metrics for ${device.name}`);

      return {
        success: true,
        device: device.name,
        timestamp: result.timestamp,
        metrics_count: result.metrics ? Object.keys(result.metrics).length : 0
      };
    } else {
      // Collection failed
      await metricsService.updateNodeStatus(device.id, 'down', new Date());

      console.error(`✗ Failed to collect metrics for ${device.name}: ${result.error}`);

      throw new Error(result.error || 'Collection failed');
    }

  } catch (error) {
    // Mark device as down on error
    await metricsService.updateNodeStatus(device.id, 'down', new Date());

    console.error(`✗ Error collecting metrics for ${device.name}:`, error.message);

    throw error;
  }
});

/**
 * Process batch monitoring jobs (collect from all devices)
 */
monitoringQueue.process('collect-all-metrics', async (job) => {
  console.log(`[${new Date().toISOString()}] Starting batch collection for all devices`);

  try {
    // Get all active nodes
    const result = await query(
      'SELECT id, name, type, ip_address, metadata FROM nodes ORDER BY name'
    );

    const devices = result.rows;
    console.log(`Found ${devices.length} devices to monitor`);

    // Schedule individual collection jobs for each device
    const jobs = devices.map(device => ({
      name: 'collect-device-metrics',
      data: { device },
      opts: {
        priority: device.type === 'esxi' || device.type === 'windows_server' ? 1 : 2
      }
    }));

    // Add all jobs to the queue
    await monitoringQueue.addBulk(jobs);

    console.log(`✓ Scheduled ${jobs.length} device collection jobs`);

    return {
      success: true,
      devices_scheduled: jobs.length,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('✗ Error in batch collection:', error.message);
    throw error;
  }
});

/**
 * Queue event handlers
 */
monitoringQueue.on('completed', (job, result) => {
  console.log(`✓ Job ${job.id} completed:`, result);
});

monitoringQueue.on('failed', (job, error) => {
  console.error(`✗ Job ${job.id} failed:`, error.message);
});

monitoringQueue.on('stalled', (job) => {
  console.warn(`⚠ Job ${job.id} stalled`);
});

/**
 * Schedule recurring monitoring jobs
 */
async function scheduleMonitoring() {
  try {
    console.log('\n================================');
    console.log('🔄 Monitoring Worker Starting');
    console.log('================================\n');

    // Remove any existing repeatable jobs
    const repeatableJobs = await monitoringQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await monitoringQueue.removeRepeatableByKey(job.key);
    }
    console.log('✓ Cleared existing scheduled jobs');

    // Get all active devices and schedule monitoring
    const result = await query(
      'SELECT id, name, type, ip_address, metadata FROM nodes ORDER BY name'
    );

    const devices = result.rows;
    console.log(`✓ Found ${devices.length} devices to monitor\n`);

    // Schedule individual device monitoring
    for (const device of devices) {
      // Determine polling interval based on device priority
      // Critical infrastructure: every 1 minute
      // Regular devices: every 5 minutes
      const isCritical = ['esxi', 'windows_server', 'fortigate', 'pfsense'].includes(device.type);
      const cronInterval = isCritical ? '*/1 * * * *' : '*/5 * * * *';

      await monitoringQueue.add(
        'collect-device-metrics',
        { device },
        {
          repeat: { cron: cronInterval },
          jobId: `monitor-${device.id}`,
          priority: isCritical ? 1 : 2
        }
      );

      console.log(`  ✓ Scheduled: ${device.name} (${device.type}) - ${isCritical ? '1 min' : '5 min'} interval`);
    }

    console.log('\n✅ Monitoring scheduled successfully');
    console.log('================================\n');

    // Run initial collection immediately
    await monitoringQueue.add('collect-all-metrics', {}, { priority: 1 });
    console.log('🚀 Triggered initial metrics collection\n');

    return {
      success: true,
      devices_scheduled: devices.length
    };

  } catch (error) {
    console.error('❌ Error scheduling monitoring:', error);
    throw error;
  }
}

/**
 * Stop monitoring and clean up
 */
async function stopMonitoring() {
  try {
    console.log('\n🛑 Stopping monitoring worker...');

    // Remove all repeatable jobs
    const repeatableJobs = await monitoringQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await monitoringQueue.removeRepeatableByKey(job.key);
    }

    // Close the queue
    await monitoringQueue.close();

    // Close collector sessions
    snmpCollector.closeAllSessions();
    wmiCollector.closeAllClients();

    console.log('✓ Monitoring worker stopped');

  } catch (error) {
    console.error('Error stopping monitoring:', error);
  }
}

/**
 * Get queue status and statistics
 */
async function getQueueStatus() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      monitoringQueue.getWaitingCount(),
      monitoringQueue.getActiveCount(),
      monitoringQueue.getCompletedCount(),
      monitoringQueue.getFailedCount(),
      monitoringQueue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  } catch (error) {
    console.error('Error getting queue status:', error);
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  await stopMonitoring();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received');
  await stopMonitoring();
  process.exit(0);
});

module.exports = {
  monitoringQueue,
  scheduleMonitoring,
  stopMonitoring,
  getQueueStatus
};
