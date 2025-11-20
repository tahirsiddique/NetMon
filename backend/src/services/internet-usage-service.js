const { query } = require('../config/database');
const usernameResolver = require('./username-resolver');

/**
 * Internet Usage Service
 * Handles aggregation, storage, and retrieval of internet usage data
 */
class InternetUsageService {
  constructor() {
    this.aggregationBuffer = new Map(); // Temporary buffer for aggregation
    this.bufferFlushInterval = 60000; // Flush every minute
    this.startAutoFlush();
  }

  /**
   * Record internet usage from NetFlow data
   */
  async recordUsage(flowData) {
    try {
      const {
        sourceIP,
        destinationIP,
        bytes,
        packets = 0,
        protocol = 'TCP'
      } = flowData;

      // Resolve username for source IP
      const username = await usernameResolver.resolveUsername(sourceIP);
      const hostname = await usernameResolver.resolveHostname(sourceIP);

      // Aggregate in buffer
      const key = `${sourceIP}:${destinationIP}:${protocol}`;

      if (this.aggregationBuffer.has(key)) {
        const existing = this.aggregationBuffer.get(key);
        existing.bytes_sent += bytes;
        existing.packets += packets;
        existing.lastSeen = new Date();
      } else {
        this.aggregationBuffer.set(key, {
          sourceIP,
          destinationIP,
          username,
          hostname,
          protocol,
          bytes_sent: bytes,
          bytes_received: 0, // We'll calculate from reverse flows
          packets,
          firstSeen: new Date(),
          lastSeen: new Date()
        });
      }

      return { success: true };

    } catch (error) {
      console.error('Error recording usage:', error);
      throw error;
    }
  }

  /**
   * Flush aggregation buffer to database
   */
  async flushBuffer() {
    if (this.aggregationBuffer.size === 0) {
      return { flushed: 0 };
    }

    const entries = Array.from(this.aggregationBuffer.values());
    let flushed = 0;

    try {
      for (const entry of entries) {
        await query(
          `INSERT INTO internet_usage (
            time, ip_address, username, hostname,
            bytes_sent, bytes_received, protocol, destination
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (time, ip_address) DO UPDATE SET
            bytes_sent = internet_usage.bytes_sent + EXCLUDED.bytes_sent,
            bytes_received = internet_usage.bytes_received + EXCLUDED.bytes_received`,
          [
            entry.lastSeen,
            entry.sourceIP,
            entry.username,
            entry.hostname,
            entry.bytes_sent,
            entry.bytes_received,
            entry.protocol,
            entry.destinationIP
          ]
        );

        flushed++;
      }

      this.aggregationBuffer.clear();

      if (flushed > 0) {
        console.log(`✓ Flushed ${flushed} internet usage records to database`);
      }

      return { flushed };

    } catch (error) {
      console.error('Error flushing usage buffer:', error);
      throw error;
    }
  }

  /**
   * Start automatic buffer flushing
   */
  startAutoFlush() {
    this.flushInterval = setInterval(() => {
      this.flushBuffer().catch(err => {
        console.error('Auto-flush error:', err);
      });
    }, this.bufferFlushInterval);
  }

  /**
   * Stop automatic buffer flushing
   */
  stopAutoFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }

  /**
   * Get top internet users
   */
  async getTopUsers(timeRange = 'today', limit = 20) {
    try {
      const interval = this.parseTimeRange(timeRange);

      const result = await query(
        `SELECT
           username,
           hostname,
           ip_address,
           SUM(bytes_sent) as bytes_sent,
           SUM(bytes_received) as bytes_received,
           SUM(bytes_sent + bytes_received) as total_bytes,
           COUNT(DISTINCT time) as session_count
         FROM internet_usage
         WHERE time > NOW() - INTERVAL '${interval}'
           AND username IS NOT NULL
           AND username != 'Unknown'
         GROUP BY username, hostname, ip_address
         ORDER BY total_bytes DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows;

    } catch (error) {
      console.error('Error getting top users:', error);
      throw error;
    }
  }

  /**
   * Get usage by user
   */
  async getUserUsage(username, timeRange = 'today') {
    try {
      const interval = this.parseTimeRange(timeRange);

      const result = await query(
        `SELECT
           time,
           ip_address,
           hostname,
           bytes_sent,
           bytes_received,
           protocol,
           destination
         FROM internet_usage
         WHERE username = $1
           AND time > NOW() - INTERVAL '${interval}'
         ORDER BY time DESC
         LIMIT 1000`,
        [username]
      );

      // Aggregate totals
      const summary = await query(
        `SELECT
           SUM(bytes_sent) as total_sent,
           SUM(bytes_received) as total_received,
           SUM(bytes_sent + bytes_received) as total_bytes,
           COUNT(DISTINCT DATE(time)) as days_active,
           MIN(time) as first_seen,
           MAX(time) as last_seen
         FROM internet_usage
         WHERE username = $1
           AND time > NOW() - INTERVAL '${interval}'`,
        [username]
      );

      return {
        username,
        summary: summary.rows[0],
        details: result.rows
      };

    } catch (error) {
      console.error('Error getting user usage:', error);
      throw error;
    }
  }

  /**
   * Get usage by protocol
   */
  async getUsageByProtocol(timeRange = 'today') {
    try {
      const interval = this.parseTimeRange(timeRange);

      const result = await query(
        `SELECT
           protocol,
           SUM(bytes_sent + bytes_received) as total_bytes,
           COUNT(*) as flow_count,
           COUNT(DISTINCT ip_address) as unique_ips
         FROM internet_usage
         WHERE time > NOW() - INTERVAL '${interval}'
         GROUP BY protocol
         ORDER BY total_bytes DESC`,
        []
      );

      return result.rows;

    } catch (error) {
      console.error('Error getting protocol usage:', error);
      throw error;
    }
  }

  /**
   * Get usage time series for charts
   */
  async getUsageTimeSeries(timeRange = 'today', granularity = 'hour') {
    try {
      const interval = this.parseTimeRange(timeRange);
      const timeFormat = this.getTimeFormat(granularity);

      const result = await query(
        `SELECT
           date_trunc('${granularity}', time) as time_bucket,
           SUM(bytes_sent) as bytes_sent,
           SUM(bytes_received) as bytes_received,
           SUM(bytes_sent + bytes_received) as total_bytes,
           COUNT(DISTINCT ip_address) as unique_users
         FROM internet_usage
         WHERE time > NOW() - INTERVAL '${interval}'
         GROUP BY time_bucket
         ORDER BY time_bucket ASC`,
        []
      );

      return result.rows;

    } catch (error) {
      console.error('Error getting usage time series:', error);
      throw error;
    }
  }

  /**
   * Get top destinations (most accessed sites/IPs)
   */
  async getTopDestinations(timeRange = 'today', limit = 20) {
    try {
      const interval = this.parseTimeRange(timeRange);

      const result = await query(
        `SELECT
           destination,
           SUM(bytes_sent + bytes_received) as total_bytes,
           COUNT(DISTINCT ip_address) as unique_users,
           COUNT(*) as connection_count
         FROM internet_usage
         WHERE time > NOW() - INTERVAL '${interval}'
           AND destination IS NOT NULL
         GROUP BY destination
         ORDER BY total_bytes DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows;

    } catch (error) {
      console.error('Error getting top destinations:', error);
      throw error;
    }
  }

  /**
   * Get overall usage statistics
   */
  async getOverallStats(timeRange = 'today') {
    try {
      const interval = this.parseTimeRange(timeRange);

      const result = await query(
        `SELECT
           SUM(bytes_sent) as total_sent,
           SUM(bytes_received) as total_received,
           SUM(bytes_sent + bytes_received) as total_bytes,
           COUNT(DISTINCT ip_address) as unique_users,
           COUNT(DISTINCT username) as known_users,
           COUNT(*) as total_flows
         FROM internet_usage
         WHERE time > NOW() - INTERVAL '${interval}'`,
        []
      );

      return result.rows[0];

    } catch (error) {
      console.error('Error getting overall stats:', error);
      throw error;
    }
  }

  /**
   * Search users by username or hostname
   */
  async searchUsers(searchTerm) {
    try {
      const result = await query(
        `SELECT DISTINCT
           username,
           hostname,
           ip_address,
           MAX(time) as last_seen
         FROM internet_usage
         WHERE (username ILIKE $1 OR hostname ILIKE $1)
           AND time > NOW() - INTERVAL '30 days'
         GROUP BY username, hostname, ip_address
         ORDER BY last_seen DESC
         LIMIT 50`,
        [`%${searchTerm}%`]
      );

      return result.rows;

    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  /**
   * Export usage data to CSV format
   */
  async exportToCSV(timeRange = 'today', username = null) {
    try {
      const interval = this.parseTimeRange(timeRange);

      let whereClause = `WHERE time > NOW() - INTERVAL '${interval}'`;
      const params = [];

      if (username) {
        whereClause += ' AND username = $1';
        params.push(username);
      }

      const result = await query(
        `SELECT
           time,
           username,
           hostname,
           ip_address,
           bytes_sent,
           bytes_received,
           protocol,
           destination
         FROM internet_usage
         ${whereClause}
         ORDER BY time DESC
         LIMIT 10000`,
        params
      );

      // Generate CSV
      const headers = ['Time', 'Username', 'Hostname', 'IP Address', 'Bytes Sent', 'Bytes Received', 'Total Bytes', 'Protocol', 'Destination'];
      const csv = [headers.join(',')];

      for (const row of result.rows) {
        csv.push([
          row.time.toISOString(),
          row.username || '',
          row.hostname || '',
          row.ip_address || '',
          row.bytes_sent,
          row.bytes_received,
          (row.bytes_sent + row.bytes_received),
          row.protocol,
          row.destination || ''
        ].join(','));
      }

      return csv.join('\n');

    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  /**
   * Parse time range to SQL interval
   */
  parseTimeRange(timeRange) {
    const ranges = {
      'today': '1 day',
      'yesterday': '2 days', // We'll filter for yesterday specifically
      'week': '7 days',
      'month': '30 days',
      '3months': '90 days',
      'year': '365 days'
    };

    return ranges[timeRange] || '1 day';
  }

  /**
   * Get time format for date_trunc
   */
  getTimeFormat(granularity) {
    const formats = {
      'minute': 'minute',
      'hour': 'hour',
      'day': 'day',
      'week': 'week',
      'month': 'month'
    };

    return formats[granularity] || 'hour';
  }

  /**
   * Clean up old usage data (retention policy)
   */
  async cleanupOldData(retentionDays = 180) {
    try {
      const result = await query(
        `DELETE FROM internet_usage
         WHERE time < NOW() - INTERVAL '${retentionDays} days'`,
        []
      );

      console.log(`Cleaned up ${result.rowCount} old internet usage records`);
      return { deleted: result.rowCount };

    } catch (error) {
      console.error('Error cleaning up usage data:', error);
      throw error;
    }
  }
}

module.exports = new InternetUsageService();
