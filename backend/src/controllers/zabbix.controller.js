const zabbixIntegration = require('../services/integrations/zabbix-integration');
const { query } = require('../config/database');

/**
 * Test Zabbix API connection
 */
async function testConnection(req, res) {
  try {
    const result = await zabbixIntegration.testConnection();

    res.json({
      success: result.success,
      data: result
    });

  } catch (error) {
    console.error('Zabbix connection test error:', error);
    res.status(500).json({
      error: 'Failed to test Zabbix connection',
      details: error.message
    });
  }
}

/**
 * Sync internet links from Zabbix
 */
async function syncInternetLinks(req, res) {
  try {
    const result = await zabbixIntegration.syncInternetLinks();

    res.json({
      success: true,
      message: `Synced ${result.synced} internet links`,
      data: result
    });

  } catch (error) {
    console.error('Sync internet links error:', error);
    res.status(500).json({
      error: 'Failed to sync internet links',
      details: error.message
    });
  }
}

/**
 * Get all internet links from local database
 */
async function getInternetLinks(req, res) {
  try {
    const { status, type } = req.query;

    let sql = 'SELECT * FROM zabbix_internet_links WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      sql += ` AND link_type = $${params.length}`;
    }

    sql += ' ORDER BY link_name';

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get internet links error:', error);
    res.status(500).json({
      error: 'Failed to retrieve internet links'
    });
  }
}

/**
 * Get specific internet link by ID
 */
async function getInternetLinkById(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM zabbix_internet_links WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Internet link not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get internet link error:', error);
    res.status(500).json({
      error: 'Failed to retrieve internet link'
    });
  }
}

/**
 * Get internet link by Zabbix host ID
 */
async function getInternetLinkByHostId(req, res) {
  try {
    const { hostId } = req.params;

    const result = await query(
      'SELECT * FROM zabbix_internet_links WHERE zabbix_host_id = $1',
      [hostId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Internet link not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get internet link by host ID error:', error);
    res.status(500).json({
      error: 'Failed to retrieve internet link'
    });
  }
}

/**
 * Get internet links statistics
 */
async function getInternetLinksStats(req, res) {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total_links,
        COUNT(*) FILTER (WHERE status = 'up') as links_up,
        COUNT(*) FILTER (WHERE status = 'down') as links_down,
        COUNT(*) FILTER (WHERE status = 'unknown') as links_unknown,
        SUM(bandwidth_in) as total_bandwidth_in,
        SUM(bandwidth_out) as total_bandwidth_out,
        AVG(bandwidth_in) FILTER (WHERE bandwidth_in > 0) as avg_bandwidth_in,
        AVG(bandwidth_out) FILTER (WHERE bandwidth_out > 0) as avg_bandwidth_out,
        MAX(last_seen) as last_sync
      FROM zabbix_internet_links
    `);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get internet links stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics'
    });
  }
}

/**
 * Get bandwidth history for a link
 */
async function getLinkBandwidthHistory(req, res) {
  try {
    const { hostId } = req.params;
    const { hours = 24 } = req.query;

    // For now, return data from local database
    // In future, could integrate with Zabbix history API
    const result = await query(`
      SELECT
        link_name,
        bandwidth_in,
        bandwidth_out,
        last_seen
      FROM zabbix_internet_links
      WHERE zabbix_host_id = $1
    `, [hostId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Link not found'
      });
    }

    // For now, return current values
    // TODO: Implement historical data from Zabbix or create local metrics table
    res.json({
      success: true,
      data: {
        link: result.rows[0],
        history: [{
          timestamp: result.rows[0].last_seen,
          bandwidth_in: result.rows[0].bandwidth_in,
          bandwidth_out: result.rows[0].bandwidth_out
        }]
      },
      message: 'Historical data integration pending - showing latest values'
    });

  } catch (error) {
    console.error('Get bandwidth history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve bandwidth history'
    });
  }
}

/**
 * Get active problems from Zabbix
 */
async function getActiveProblems(req, res) {
  try {
    const problems = await zabbixIntegration.getActiveProblems();

    res.json({
      success: true,
      data: problems
    });

  } catch (error) {
    console.error('Get active problems error:', error);
    res.status(500).json({
      error: 'Failed to retrieve active problems',
      details: error.message
    });
  }
}

/**
 * Manually update a specific link
 */
async function updateLink(req, res) {
  try {
    const { id } = req.params;
    const { link_name, link_type, description } = req.body;

    const result = await query(`
      UPDATE zabbix_internet_links
      SET
        link_name = COALESCE($1, link_name),
        link_type = COALESCE($2, link_type),
        description = COALESCE($3, description),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [link_name, link_type, description, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Internet link not found'
      });
    }

    res.json({
      success: true,
      message: 'Link updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update link error:', error);
    res.status(500).json({
      error: 'Failed to update link'
    });
  }
}

/**
 * Get links grouped by type
 */
async function getLinksByType(req, res) {
  try {
    const result = await query(`
      SELECT
        link_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'up') as up_count,
        COUNT(*) FILTER (WHERE status = 'down') as down_count,
        AVG(bandwidth_in) as avg_bandwidth_in,
        AVG(bandwidth_out) as avg_bandwidth_out
      FROM zabbix_internet_links
      GROUP BY link_type
      ORDER BY link_type
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get links by type error:', error);
    res.status(500).json({
      error: 'Failed to retrieve links by type'
    });
  }
}

module.exports = {
  testConnection,
  syncInternetLinks,
  getInternetLinks,
  getInternetLinkById,
  getInternetLinkByHostId,
  getInternetLinksStats,
  getLinkBandwidthHistory,
  getActiveProblems,
  updateLink,
  getLinksByType
};
