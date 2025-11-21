const metricsService = require('../services/metrics-service');
const { query } = require('../config/database');

/**
 * Get metrics for a specific node
 */
async function getNodeMetrics(req, res) {
  try {
    const { nodeId } = req.params;
    const { timeRange = '1h', metricTypes } = req.query;

    const metricTypesArray = metricTypes ? metricTypes.split(',') : null;

    const metrics = await metricsService.getNodeMetrics(nodeId, timeRange, metricTypesArray);

    res.json({
      success: true,
      data: metrics,
      timeRange
    });

  } catch (error) {
    console.error('Get node metrics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve node metrics'
    });
  }
}

/**
 * Get time-series data for multiple nodes
 */
async function getTimeSeriesData(req, res) {
  try {
    const { node_ids, metric_type, time_range = '1h' } = req.body;

    if (!node_ids || !Array.isArray(node_ids) || node_ids.length === 0) {
      return res.status(400).json({
        error: 'node_ids array is required'
      });
    }

    if (!metric_type) {
      return res.status(400).json({
        error: 'metric_type is required'
      });
    }

    const data = await metricsService.getTimeSeriesData(node_ids, metric_type, time_range);

    res.json({
      success: true,
      ...data,
      time_range
    });

  } catch (error) {
    console.error('Get time series error:', error);
    res.status(500).json({
      error: 'Failed to retrieve time series data'
    });
  }
}

/**
 * Get latest metric value for a node
 */
async function getLatestMetric(req, res) {
  try {
    const { nodeId, metricType } = req.params;

    const metric = await metricsService.getLatestMetric(nodeId, metricType);

    if (!metric) {
      return res.status(404).json({
        error: 'Metric not found'
      });
    }

    res.json({
      success: true,
      data: metric
    });

  } catch (error) {
    console.error('Get latest metric error:', error);
    res.status(500).json({
      error: 'Failed to retrieve metric'
    });
  }
}

/**
 * Get available metric types for a node
 */
async function getAvailableMetrics(req, res) {
  try {
    const { nodeId } = req.params;

    const result = await query(
      `SELECT DISTINCT metric_type, unit
       FROM metrics
       WHERE node_id = $1
       ORDER BY metric_type`,
      [nodeId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get available metrics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve available metrics'
    });
  }
}

/**
 * Get aggregated statistics for a metric
 */
async function getMetricStats(req, res) {
  try {
    const { nodeId, metricType } = req.params;
    const { timeRange = '24h' } = req.query;

    const intervalMap = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    };

    const interval = intervalMap[timeRange] || '24 hours';

    const result = await query(
      `SELECT
         AVG(value) as avg_value,
         MIN(value) as min_value,
         MAX(value) as max_value,
         COUNT(*) as sample_count,
         unit
       FROM metrics
       WHERE node_id = $1
         AND metric_type = $2
         AND time > NOW() - INTERVAL '${interval}'
       GROUP BY unit`,
      [nodeId, metricType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No data found for this metric'
      });
    }

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        metric_type: metricType,
        avg_value: parseFloat(stats.avg_value),
        min_value: parseFloat(stats.min_value),
        max_value: parseFloat(stats.max_value),
        sample_count: parseInt(stats.sample_count),
        unit: stats.unit
      },
      time_range: timeRange
    });

  } catch (error) {
    console.error('Get metric stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve metric statistics'
    });
  }
}

/**
 * Get service status for Windows servers
 */
async function getServiceStatus(req, res) {
  try {
    const { nodeId } = req.params;

    const result = await query(
      `SELECT DISTINCT ON (service_name)
         service_name,
         status,
         checked_at
       FROM service_status
       WHERE node_id = $1
       ORDER BY service_name, checked_at DESC`,
      [nodeId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get service status error:', error);
    res.status(500).json({
      error: 'Failed to retrieve service status'
    });
  }
}

/**
 * Get hardware health status
 */
async function getHardwareHealth(req, res) {
  try {
    const { nodeId } = req.params;

    const result = await query(
      `SELECT DISTINCT ON (component_type, component_name)
         component_type,
         component_name,
         status,
         details,
         checked_at
       FROM hardware_health
       WHERE node_id = $1
       ORDER BY component_type, component_name, checked_at DESC`,
      [nodeId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get hardware health error:', error);
    res.status(500).json({
      error: 'Failed to retrieve hardware health'
    });
  }
}

module.exports = {
  getNodeMetrics,
  getTimeSeriesData,
  getLatestMetric,
  getAvailableMetrics,
  getMetricStats,
  getServiceStatus,
  getHardwareHealth
};
