const { query } = require('../config/database');
const { broadcastAlert } = require('../config/socket');

/**
 * Alert Rules Service
 *
 * Evaluates alert rules against current metrics and triggers alerts
 * when thresholds are exceeded.
 */
class AlertRulesService {
  constructor() {
    this.evaluationCache = new Map();
    this.cooldownPeriod = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get all active alert rules
   */
  async getActiveRules() {
    try {
      const result = await query(`
        SELECT ar.*, n.name as node_name, n.type as node_type, n.ip_address
        FROM alert_rules ar
        LEFT JOIN nodes n ON ar.node_id = n.id
        WHERE ar.enabled = true
        ORDER BY ar.priority DESC, ar.created_at
      `);

      return result.rows;
    } catch (error) {
      console.error('Failed to get active rules:', error);
      return [];
    }
  }

  /**
   * Evaluate all active alert rules
   */
  async evaluateAllRules() {
    try {
      const rules = await this.getActiveRules();
      console.log(`Evaluating ${rules.length} active alert rules...`);

      const results = {
        evaluated: 0,
        triggered: 0,
        resolved: 0,
        errors: 0
      };

      for (const rule of rules) {
        try {
          const triggered = await this.evaluateRule(rule);
          results.evaluated++;

          if (triggered) {
            results.triggered++;
          }
        } catch (error) {
          console.error(`Error evaluating rule ${rule.id}:`, error.message);
          results.errors++;
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to evaluate rules:', error);
      throw error;
    }
  }

  /**
   * Evaluate a single alert rule
   */
  async evaluateRule(rule) {
    try {
      // Check cooldown period
      const cacheKey = `rule_${rule.id}`;
      const lastEval = this.evaluationCache.get(cacheKey);

      if (lastEval && (Date.now() - lastEval) < this.cooldownPeriod) {
        return false; // Skip evaluation during cooldown
      }

      // Get current metric value
      const currentValue = await this.getCurrentMetricValue(rule);

      if (currentValue === null) {
        return false; // No data available
      }

      // Evaluate condition
      const conditionMet = this.evaluateCondition(
        currentValue,
        rule.condition_operator,
        rule.threshold_value
      );

      // Check if alert already exists
      const existingAlert = await this.getActiveAlert(rule.id);

      if (conditionMet && !existingAlert) {
        // Trigger new alert
        await this.triggerAlert(rule, currentValue);
        this.evaluationCache.set(cacheKey, Date.now());
        return true;
      } else if (!conditionMet && existingAlert) {
        // Resolve existing alert
        await this.resolveAlert(existingAlert.id);
        this.evaluationCache.delete(cacheKey);
        return false;
      }

      return false;
    } catch (error) {
      console.error(`Failed to evaluate rule ${rule.id}:`, error);
      throw error;
    }
  }

  /**
   * Get current metric value for a rule
   */
  async getCurrentMetricValue(rule) {
    try {
      let result;

      switch (rule.metric_type) {
        case 'cpu_usage':
        case 'memory_usage':
        case 'disk_usage':
        case 'network_bandwidth':
          // Get latest metric from metrics table
          result = await query(`
            SELECT value
            FROM metrics
            WHERE node_id = $1
              AND metric_type = $2
              AND time > NOW() - INTERVAL '5 minutes'
            ORDER BY time DESC
            LIMIT 1
          `, [rule.node_id, rule.metric_type]);
          break;

        case 'node_status':
          // Get node status
          result = await query(`
            SELECT
              CASE status
                WHEN 'up' THEN 1
                WHEN 'down' THEN 0
                WHEN 'warning' THEN 0.5
                ELSE 0
              END as value
            FROM nodes
            WHERE id = $1
          `, [rule.node_id]);
          break;

        case 'service_status':
          // Get service status
          result = await query(`
            SELECT
              CASE state
                WHEN 'running' THEN 1
                WHEN 'stopped' THEN 0
                ELSE 0.5
              END as value
            FROM service_status
            WHERE node_id = $1
              AND service_name = $2
              AND checked_at > NOW() - INTERVAL '10 minutes'
            ORDER BY checked_at DESC
            LIMIT 1
          `, [rule.node_id, rule.metadata?.service_name || '']);
          break;

        case 'response_time':
          // Get average response time
          result = await query(`
            SELECT AVG(value) as value
            FROM metrics
            WHERE node_id = $1
              AND metric_type = 'response_time'
              AND time > NOW() - INTERVAL '5 minutes'
          `, [rule.node_id]);
          break;

        default:
          console.log(`Unknown metric type: ${rule.metric_type}`);
          return null;
      }

      if (result.rows.length > 0 && result.rows[0].value !== null) {
        return parseFloat(result.rows[0].value);
      }

      return null;
    } catch (error) {
      console.error('Failed to get current metric value:', error);
      return null;
    }
  }

  /**
   * Evaluate condition
   */
  evaluateCondition(currentValue, operator, threshold) {
    switch (operator) {
      case 'gt':
        return currentValue > threshold;
      case 'gte':
        return currentValue >= threshold;
      case 'lt':
        return currentValue < threshold;
      case 'lte':
        return currentValue <= threshold;
      case 'eq':
        return currentValue === threshold;
      case 'neq':
        return currentValue !== threshold;
      default:
        console.log(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Check if an alert is already active for a rule
   */
  async getActiveAlert(ruleId) {
    try {
      const result = await query(`
        SELECT id, triggered_at, severity
        FROM alerts
        WHERE rule_id = $1
          AND resolved_at IS NULL
        ORDER BY triggered_at DESC
        LIMIT 1
      `, [ruleId]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Failed to get active alert:', error);
      return null;
    }
  }

  /**
   * Trigger a new alert
   */
  async triggerAlert(rule, currentValue) {
    try {
      const message = this.formatAlertMessage(rule, currentValue);

      const result = await query(`
        INSERT INTO alerts (
          rule_id,
          node_id,
          severity,
          message,
          current_value,
          threshold_value,
          triggered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [
        rule.id,
        rule.node_id,
        rule.severity,
        message,
        currentValue,
        rule.threshold_value
      ]);

      const alert = result.rows[0];

      console.log(`🚨 Alert triggered: ${message}`);

      // Broadcast alert via WebSocket
      broadcastAlert({
        id: alert.id,
        rule_id: rule.id,
        node_id: rule.node_id,
        node_name: rule.node_name,
        severity: alert.severity,
        message: alert.message,
        triggered_at: alert.triggered_at
      });

      return alert;
    } catch (error) {
      console.error('Failed to trigger alert:', error);
      throw error;
    }
  }

  /**
   * Resolve an active alert
   */
  async resolveAlert(alertId) {
    try {
      await query(`
        UPDATE alerts
        SET resolved_at = NOW(),
            auto_resolved = true
        WHERE id = $1
      `, [alertId]);

      console.log(`✓ Alert ${alertId} auto-resolved`);

      // Broadcast resolution via WebSocket
      broadcastAlert({
        id: alertId,
        resolved: true,
        resolved_at: new Date()
      });

      return true;
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      throw error;
    }
  }

  /**
   * Format alert message
   */
  formatAlertMessage(rule, currentValue) {
    const operatorText = {
      'gt': 'is above',
      'gte': 'is at or above',
      'lt': 'is below',
      'lte': 'is at or below',
      'eq': 'equals',
      'neq': 'does not equal'
    };

    const metricDisplay = this.getMetricDisplay(rule.metric_type, currentValue);
    const thresholdDisplay = this.getMetricDisplay(rule.metric_type, rule.threshold_value);

    return `${rule.node_name || 'Node'}: ${rule.metric_type.replace(/_/g, ' ')} ${operatorText[rule.condition_operator]} threshold. Current: ${metricDisplay}, Threshold: ${thresholdDisplay}`;
  }

  /**
   * Get metric display value
   */
  getMetricDisplay(metricType, value) {
    switch (metricType) {
      case 'cpu_usage':
      case 'memory_usage':
      case 'disk_usage':
        return `${value.toFixed(1)}%`;
      case 'response_time':
        return `${value.toFixed(0)}ms`;
      case 'network_bandwidth':
        return `${(value / 1024 / 1024).toFixed(2)} Mbps`;
      case 'node_status':
        return value === 1 ? 'Up' : value === 0 ? 'Down' : 'Warning';
      case 'service_status':
        return value === 1 ? 'Running' : value === 0 ? 'Stopped' : 'Unknown';
      default:
        return value.toString();
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, userId, comment) {
    try {
      await query(`
        UPDATE alerts
        SET acknowledged = true,
            acknowledged_at = NOW(),
            acknowledged_by = $2,
            acknowledgement_comment = $3
        WHERE id = $1
      `, [alertId, userId, comment]);

      console.log(`✓ Alert ${alertId} acknowledged by user ${userId}`);

      return true;
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(timeRange = '24h') {
    try {
      const intervalMap = {
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };

      const interval = intervalMap[timeRange] || '24 hours';

      const result = await query(`
        SELECT
          COUNT(*) as total_alerts,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE severity = 'warning') as warning_count,
          COUNT(*) FILTER (WHERE severity = 'info') as info_count,
          COUNT(*) FILTER (WHERE resolved_at IS NULL) as active_count,
          COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) as resolved_count,
          COUNT(*) FILTER (WHERE acknowledged = true) as acknowledged_count,
          AVG(EXTRACT(EPOCH FROM (resolved_at - triggered_at))) as avg_resolution_time
        FROM alerts
        WHERE triggered_at > NOW() - INTERVAL '${interval}'
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to get alert statistics:', error);
      throw error;
    }
  }
}

// Singleton instance
const alertRulesService = new AlertRulesService();

module.exports = alertRulesService;
