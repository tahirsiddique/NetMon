const { query } = require('../config/database');
const alertRulesService = require('../services/alert-rules-service');
const emailNotificationService = require('../services/email-notification-service');

/**
 * Get all alerts with filtering
 */
async function getAlerts(req, res) {
  try {
    const {
      status = 'all', // all, active, resolved
      severity,
      nodeId,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT a.*, n.name as node_name, n.type as node_type,
             ar.metric_type, ar.description as rule_description,
             u.username as acknowledged_by_username
      FROM alerts a
      LEFT JOIN nodes n ON a.node_id = n.id
      LEFT JOIN alert_rules ar ON a.rule_id = ar.id
      LEFT JOIN users u ON a.acknowledged_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by status
    if (status === 'active') {
      sql += ' AND a.resolved_at IS NULL';
    } else if (status === 'resolved') {
      sql += ' AND a.resolved_at IS NOT NULL';
    }

    // Filter by severity
    if (severity) {
      params.push(severity);
      sql += ` AND a.severity = $${params.length}`;
    }

    // Filter by node
    if (nodeId) {
      params.push(nodeId);
      sql += ` AND a.node_id = $${params.length}`;
    }

    sql += ` ORDER BY a.triggered_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve alerts'
    });
  }
}

/**
 * Get alert by ID
 */
async function getAlertById(req, res) {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT a.*, n.name as node_name, n.type as node_type, n.ip_address,
             ar.metric_type, ar.condition_operator, ar.threshold_value,
             ar.description as rule_description,
             u.username as acknowledged_by_username
      FROM alerts a
      LEFT JOIN nodes n ON a.node_id = n.id
      LEFT JOIN alert_rules ar ON a.rule_id = ar.id
      LEFT JOIN users u ON a.acknowledged_by = u.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get alert by ID error:', error);
    res.status(500).json({
      error: 'Failed to retrieve alert'
    });
  }
}

/**
 * Acknowledge alert
 */
async function acknowledgeAlert(req, res) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    await alertRulesService.acknowledgeAlert(id, userId, comment);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });

  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({
      error: 'Failed to acknowledge alert'
    });
  }
}

/**
 * Resolve alert manually
 */
async function resolveAlert(req, res) {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    await query(`
      UPDATE alerts
      SET resolved_at = NOW(),
          auto_resolved = false,
          resolution_comment = $2
      WHERE id = $1
    `, [id, comment]);

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });

  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({
      error: 'Failed to resolve alert'
    });
  }
}

/**
 * Get alert statistics
 */
async function getAlertStatistics(req, res) {
  try {
    const { timeRange = '24h' } = req.query;

    const stats = await alertRulesService.getAlertStatistics(timeRange);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get alert statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve alert statistics'
    });
  }
}

/**
 * Get all alert rules
 */
async function getAlertRules(req, res) {
  try {
    const { enabled } = req.query;

    let sql = `
      SELECT ar.*, n.name as node_name, n.type as node_type, n.ip_address
      FROM alert_rules ar
      LEFT JOIN nodes n ON ar.node_id = n.id
      WHERE 1=1
    `;
    const params = [];

    if (enabled !== undefined) {
      params.push(enabled === 'true');
      sql += ` AND ar.enabled = $${params.length}`;
    }

    sql += ' ORDER BY ar.priority DESC, ar.created_at DESC';

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get alert rules error:', error);
    res.status(500).json({
      error: 'Failed to retrieve alert rules'
    });
  }
}

/**
 * Get alert rule by ID
 */
async function getAlertRuleById(req, res) {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT ar.*, n.name as node_name, n.type as node_type, n.ip_address
      FROM alert_rules ar
      LEFT JOIN nodes n ON ar.node_id = n.id
      WHERE ar.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Alert rule not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get alert rule by ID error:', error);
    res.status(500).json({
      error: 'Failed to retrieve alert rule'
    });
  }
}

/**
 * Create alert rule
 */
async function createAlertRule(req, res) {
  try {
    const {
      name,
      description,
      node_id,
      metric_type,
      condition_operator,
      threshold_value,
      severity,
      priority,
      enabled = true,
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!name || !metric_type || !condition_operator || threshold_value === undefined || !severity) {
      return res.status(400).json({
        error: 'Missing required fields: name, metric_type, condition_operator, threshold_value, severity'
      });
    }

    // Validate operator
    const validOperators = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];
    if (!validOperators.includes(condition_operator)) {
      return res.status(400).json({
        error: `Invalid operator. Must be one of: ${validOperators.join(', ')}`
      });
    }

    // Validate severity
    const validSeverities = ['critical', 'warning', 'info'];
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
      });
    }

    const result = await query(`
      INSERT INTO alert_rules (
        name,
        description,
        node_id,
        metric_type,
        condition_operator,
        threshold_value,
        severity,
        priority,
        enabled,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `, [
      name,
      description,
      node_id,
      metric_type,
      condition_operator,
      threshold_value,
      severity,
      priority || 1,
      enabled,
      JSON.stringify(metadata)
    ]);

    res.status(201).json({
      success: true,
      message: 'Alert rule created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Create alert rule error:', error);
    res.status(500).json({
      error: 'Failed to create alert rule'
    });
  }
}

/**
 * Update alert rule
 */
async function updateAlertRule(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      node_id,
      metric_type,
      condition_operator,
      threshold_value,
      severity,
      priority,
      enabled,
      metadata
    } = req.body;

    const result = await query(`
      UPDATE alert_rules
      SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        node_id = COALESCE($4, node_id),
        metric_type = COALESCE($5, metric_type),
        condition_operator = COALESCE($6, condition_operator),
        threshold_value = COALESCE($7, threshold_value),
        severity = COALESCE($8, severity),
        priority = COALESCE($9, priority),
        enabled = COALESCE($10, enabled),
        metadata = COALESCE($11, metadata),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      id,
      name,
      description,
      node_id,
      metric_type,
      condition_operator,
      threshold_value,
      severity,
      priority,
      enabled,
      metadata ? JSON.stringify(metadata) : null
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Alert rule not found'
      });
    }

    res.json({
      success: true,
      message: 'Alert rule updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update alert rule error:', error);
    res.status(500).json({
      error: 'Failed to update alert rule'
    });
  }
}

/**
 * Delete alert rule
 */
async function deleteAlertRule(req, res) {
  try {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM alert_rules
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Alert rule not found'
      });
    }

    res.json({
      success: true,
      message: 'Alert rule deleted successfully'
    });

  } catch (error) {
    console.error('Delete alert rule error:', error);
    res.status(500).json({
      error: 'Failed to delete alert rule'
    });
  }
}

/**
 * Test email configuration
 */
async function testEmailConfiguration(req, res) {
  try {
    const { recipient } = req.body;

    if (!recipient) {
      return res.status(400).json({
        error: 'Recipient email address is required'
      });
    }

    await emailNotificationService.initialize();
    await emailNotificationService.sendTestEmail(recipient);

    res.json({
      success: true,
      message: 'Test email sent successfully'
    });

  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error.message
    });
  }
}

/**
 * Trigger manual rule evaluation
 */
async function triggerRuleEvaluation(req, res) {
  try {
    const results = await alertRulesService.evaluateAllRules();

    res.json({
      success: true,
      message: 'Rule evaluation completed',
      data: results
    });

  } catch (error) {
    console.error('Trigger rule evaluation error:', error);
    res.status(500).json({
      error: 'Failed to evaluate rules'
    });
  }
}

module.exports = {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  getAlertStatistics,
  getAlertRules,
  getAlertRuleById,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  testEmailConfiguration,
  triggerRuleEvaluation
};
