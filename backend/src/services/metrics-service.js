const { query } = require('../config/database');
const { broadcastMetricUpdate, broadcastStatusChange } = require('../config/socket');

/**
 * Metrics Service
 * Handles storing and retrieving time-series metrics data
 */
class MetricsService {
  /**
   * Save metrics collected from a device
   */
  async saveMetrics(nodeId, metricsData) {
    try {
      const timestamp = metricsData.timestamp || new Date();
      const metrics = metricsData.metrics || metricsData;

      // Flatten nested metrics and save to database
      const metricEntries = this.flattenMetrics(metrics);

      for (const [metricType, value] of metricEntries) {
        if (value !== null && value !== undefined && !isNaN(value)) {
          await query(
            `INSERT INTO metrics (time, node_id, metric_type, value, unit)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (time, node_id, metric_type) DO UPDATE
             SET value = EXCLUDED.value, unit = EXCLUDED.unit`,
            [timestamp, nodeId, metricType, value, this.getUnit(metricType)]
          );
        }
      }

      // Also save hardware health if present
      if (metrics.system_health || metrics.psu_status || metrics.fan_status) {
        await this.saveHardwareHealth(nodeId, metrics, timestamp);
      }

      // Save service status if present
      if (metrics.services && Array.isArray(metrics.services)) {
        await this.saveServiceStatus(nodeId, metrics.services, timestamp);
      }

      // Broadcast update via WebSocket
      broadcastMetricUpdate(nodeId, {
        timestamp,
        metrics: metricEntries
      });

      return { success: true };

    } catch (error) {
      console.error('Error saving metrics:', error);
      throw error;
    }
  }

  /**
   * Flatten nested metrics object to key-value pairs
   */
  flattenMetrics(obj, prefix = '') {
    const entries = [];

    for (const [key, value] of Object.entries(obj)) {
      const metricKey = prefix ? `${prefix}_${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        entries.push(...this.flattenMetrics(value, metricKey));
      } else if (typeof value === 'number') {
        entries.push([metricKey, value]);
      } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
        entries.push([metricKey, parseFloat(value)]);
      }
    }

    return entries;
  }

  /**
   * Get appropriate unit for a metric type
   */
  getUnit(metricType) {
    if (metricType.includes('percent') || metricType.includes('usage')) {
      return '%';
    } else if (metricType.includes('mb')) {
      return 'MB';
    } else if (metricType.includes('gb')) {
      return 'GB';
    } else if (metricType.includes('bytes')) {
      return 'bytes';
    } else if (metricType.includes('celsius') || metricType.includes('temperature')) {
      return '°C';
    } else if (metricType.includes('seconds')) {
      return 's';
    } else if (metricType.includes('hours')) {
      return 'h';
    }

    return null;
  }

  /**
   * Save hardware health status
   */
  async saveHardwareHealth(nodeId, metrics, timestamp) {
    const healthComponents = [
      { type: 'system', name: 'Overall System', status: metrics.system_health },
      { type: 'psu', name: 'Power Supply', status: metrics.psu_status },
      { type: 'fan', name: 'Cooling Fans', status: metrics.fan_status },
      { type: 'disk', name: 'RAID Disks', status: metrics.disk_status },
    ];

    for (const component of healthComponents) {
      if (component.status) {
        await query(
          `INSERT INTO hardware_health (node_id, component_type, component_name, status, checked_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [nodeId, component.type, component.name, component.status, timestamp]
        );
      }
    }
  }

  /**
   * Save Windows service status
   */
  async saveServiceStatus(nodeId, services, timestamp) {
    for (const service of services) {
      await query(
        `INSERT INTO service_status (node_id, service_name, status, checked_at)
         VALUES ($1, $2, $3, $4)`,
        [nodeId, service.name, service.state, timestamp]
      );
    }
  }

  /**
   * Update node status based on collection success
   */
  async updateNodeStatus(nodeId, status, lastSeen = new Date()) {
    try {
      await query(
        `UPDATE nodes
         SET status = $1, last_seen = $2, updated_at = NOW()
         WHERE id = $3`,
        [status, lastSeen, nodeId]
      );

      // Broadcast status change
      broadcastStatusChange(nodeId, status);

      return { success: true };
    } catch (error) {
      console.error('Error updating node status:', error);
      throw error;
    }
  }

  /**
   * Get recent metrics for a node
   */
  async getNodeMetrics(nodeId, timeRange = '1h', metricTypes = null) {
    try {
      const intervalMap = {
        '1h': '1 hour',
        '6h': '6 hours',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };

      const interval = intervalMap[timeRange] || '1 hour';

      let metricFilter = '';
      let params = [nodeId, interval];

      if (metricTypes && Array.isArray(metricTypes) && metricTypes.length > 0) {
        metricFilter = `AND metric_type = ANY($3)`;
        params.push(metricTypes);
      }

      const result = await query(
        `SELECT
           time,
           metric_type,
           value,
           unit
         FROM metrics
         WHERE node_id = $1
           AND time > NOW() - INTERVAL '${interval}'
           ${metricFilter}
         ORDER BY time ASC`,
        params
      );

      // Group by metric type
      const grouped = {};
      for (const row of result.rows) {
        if (!grouped[row.metric_type]) {
          grouped[row.metric_type] = {
            metric: row.metric_type,
            unit: row.unit,
            data: []
          };
        }

        grouped[row.metric_type].data.push({
          time: row.time,
          value: parseFloat(row.value)
        });
      }

      return Object.values(grouped);

    } catch (error) {
      console.error('Error getting node metrics:', error);
      throw error;
    }
  }

  /**
   * Get time-series data for multiple nodes
   */
  async getTimeSeriesData(nodeIds, metricType, timeRange = '1h') {
    try {
      const intervalMap = {
        '1h': '1 hour',
        '6h': '6 hours',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };

      const interval = intervalMap[timeRange] || '1 hour';

      const result = await query(
        `SELECT
           m.time,
           m.node_id,
           n.name as node_name,
           m.value,
           m.unit
         FROM metrics m
         JOIN nodes n ON m.node_id = n.id
         WHERE m.node_id = ANY($1)
           AND m.metric_type = $2
           AND m.time > NOW() - INTERVAL '${interval}'
         ORDER BY m.time ASC`,
        [nodeIds, metricType]
      );

      // Group by node
      const series = {};
      const timestamps = new Set();

      for (const row of result.rows) {
        timestamps.add(row.time.toISOString());

        if (!series[row.node_id]) {
          series[row.node_id] = {
            node_id: row.node_id,
            node_name: row.node_name,
            values: []
          };
        }

        series[row.node_id].values.push({
          time: row.time,
          value: parseFloat(row.value)
        });
      }

      return {
        timestamps: Array.from(timestamps).sort(),
        series: Object.values(series),
        unit: result.rows[0]?.unit || null
      };

    } catch (error) {
      console.error('Error getting time series data:', error);
      throw error;
    }
  }

  /**
   * Get latest metric value for a node
   */
  async getLatestMetric(nodeId, metricType) {
    try {
      const result = await query(
        `SELECT value, unit, time
         FROM metrics
         WHERE node_id = $1 AND metric_type = $2
         ORDER BY time DESC
         LIMIT 1`,
        [nodeId, metricType]
      );

      if (result.rows.length > 0) {
        return {
          value: parseFloat(result.rows[0].value),
          unit: result.rows[0].unit,
          timestamp: result.rows[0].time
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting latest metric:', error);
      throw error;
    }
  }

  /**
   * Clean up old metrics (retention policy)
   */
  async cleanupOldMetrics(retentionDays = 90) {
    try {
      const result = await query(
        `DELETE FROM metrics
         WHERE time < NOW() - INTERVAL '${retentionDays} days'`,
        []
      );

      console.log(`Cleaned up ${result.rowCount} old metric records`);
      return { deleted: result.rowCount };

    } catch (error) {
      console.error('Error cleaning up metrics:', error);
      throw error;
    }
  }
}

module.exports = new MetricsService();
