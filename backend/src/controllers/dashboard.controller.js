const { query } = require('../config/database');
const { cacheHelper } = require('../config/redis');

// Get dashboard overview
async function getDashboardOverview(req, res) {
  try {
    const cacheKey = 'dashboard:overview';
    const cached = await cacheHelper.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Get node statistics
    const nodeStats = await query(`
      SELECT
        COUNT(*) as total_nodes,
        COUNT(*) FILTER (WHERE status = 'up') as up_count,
        COUNT(*) FILTER (WHERE status = 'down') as down_count,
        COUNT(*) FILTER (WHERE status = 'warning') as warning_count,
        COUNT(*) FILTER (WHERE status = 'unknown') as unknown_count
      FROM nodes
    `);

    // Get critical infrastructure status
    const criticalNodes = await query(`
      SELECT id, name, type, ip_address, status, last_seen
      FROM nodes
      WHERE type IN ('esxi', 'windows_server', 'fortigate', 'pfsense', 'dell_server')
      ORDER BY
        CASE status
          WHEN 'down' THEN 1
          WHEN 'warning' THEN 2
          WHEN 'unknown' THEN 3
          WHEN 'up' THEN 4
        END,
        name
    `);

    // Get active alerts
    const activeAlerts = await query(`
      SELECT a.id, a.message, a.severity, a.triggered_at,
             n.name as node_name, n.type as node_type
      FROM alerts a
      JOIN nodes n ON a.node_id = n.id
      WHERE a.resolved_at IS NULL
      ORDER BY
        CASE a.severity
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          WHEN 'info' THEN 3
        END,
        a.triggered_at DESC
      LIMIT 10
    `);

    // Get internet link status from Zabbix
    const internetLinks = await query(`
      SELECT link_name, status, last_check
      FROM zabbix_internet_links
      ORDER BY link_name
    `);

    const overview = {
      node_stats: nodeStats.rows[0],
      critical_nodes: criticalNodes.rows,
      active_alerts: activeAlerts.rows,
      internet_links: internetLinks.rows,
      last_updated: new Date()
    };

    // Cache for 15 seconds
    await cacheHelper.set(cacheKey, overview, 15);

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      error: 'Failed to retrieve dashboard overview'
    });
  }
}

// Get metrics summary for a time range
async function getMetricsSummary(req, res) {
  try {
    const { timeRange = '1h' } = req.query;

    // Parse time range
    const intervalMap = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    };

    const interval = intervalMap[timeRange] || '1 hour';

    const result = await query(`
      SELECT
        node_id,
        n.name as node_name,
        n.type as node_type,
        metric_type,
        AVG(value) as avg_value,
        MAX(value) as max_value,
        MIN(value) as min_value
      FROM metrics m
      JOIN nodes n ON m.node_id = n.id
      WHERE time > NOW() - INTERVAL '${interval}'
      GROUP BY node_id, n.name, n.type, metric_type
      ORDER BY node_name, metric_type
    `);

    res.json({
      success: true,
      data: result.rows,
      time_range: timeRange
    });

  } catch (error) {
    console.error('Get metrics summary error:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics summary'
    });
  }
}

// Get recent activity/events
async function getRecentActivity(req, res) {
  try {
    const { limit = 50 } = req.query;

    // Get recent status changes, alerts, etc.
    const result = await query(`
      SELECT
        'alert' as event_type,
        a.id,
        a.message as description,
        a.severity,
        a.triggered_at as timestamp,
        n.name as node_name
      FROM alerts a
      JOIN nodes n ON a.node_id = n.id
      WHERE a.triggered_at > NOW() - INTERVAL '24 hours'

      UNION ALL

      SELECT
        'status_change' as event_type,
        NULL as id,
        'Status changed to ' || status as description,
        CASE status
          WHEN 'down' THEN 'critical'
          WHEN 'warning' THEN 'warning'
          ELSE 'info'
        END as severity,
        updated_at as timestamp,
        name as node_name
      FROM nodes
      WHERE updated_at > NOW() - INTERVAL '24 hours'
        AND status IN ('down', 'warning')

      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      error: 'Failed to retrieve recent activity'
    });
  }
}

module.exports = {
  getDashboardOverview,
  getMetricsSummary,
  getRecentActivity
};
