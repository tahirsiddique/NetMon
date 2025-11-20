const { query } = require('../config/database');
const { cacheHelper } = require('../config/redis');

// Get all nodes
async function getAllNodes(req, res) {
  try {
    // Try cache first
    const cacheKey = 'nodes:all';
    const cached = await cacheHelper.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Query database
    const result = await query(
      `SELECT id, name, type, ip_address, status, last_seen, metadata,
              created_at, updated_at
       FROM nodes
       ORDER BY type, name`
    );

    // Cache for 30 seconds
    await cacheHelper.set(cacheKey, result.rows, 30);

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });

  } catch (error) {
    console.error('Get nodes error:', error);
    res.status(500).json({
      error: 'Failed to retrieve nodes'
    });
  }
}

// Get node by ID
async function getNodeById(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, name, type, ip_address, status, last_seen, metadata,
              created_at, updated_at
       FROM nodes
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Node not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get node error:', error);
    res.status(500).json({
      error: 'Failed to retrieve node'
    });
  }
}

// Get nodes by type
async function getNodesByType(req, res) {
  try {
    const { type } = req.params;

    const result = await query(
      `SELECT id, name, type, ip_address, status, last_seen, metadata
       FROM nodes
       WHERE type = $1
       ORDER BY name`,
      [type]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });

  } catch (error) {
    console.error('Get nodes by type error:', error);
    res.status(500).json({
      error: 'Failed to retrieve nodes'
    });
  }
}

// Get node statistics
async function getNodeStats(req, res) {
  try {
    const cacheKey = 'nodes:stats';
    const cached = await cacheHelper.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const result = await query(`
      SELECT
        COUNT(*) as total_nodes,
        COUNT(*) FILTER (WHERE status = 'up') as up_count,
        COUNT(*) FILTER (WHERE status = 'down') as down_count,
        COUNT(*) FILTER (WHERE status = 'warning') as warning_count,
        COUNT(*) FILTER (WHERE status = 'unknown') as unknown_count,
        jsonb_object_agg(type, type_count) as by_type
      FROM (
        SELECT type, COUNT(*) as type_count
        FROM nodes
        GROUP BY type
      ) type_counts
      CROSS JOIN nodes
    `);

    const stats = result.rows[0];

    // Cache for 15 seconds
    await cacheHelper.set(cacheKey, stats, 15);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get node stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve node statistics'
    });
  }
}

// Create new node (admin only)
async function createNode(req, res) {
  try {
    const { name, type, ip_address, metadata } = req.body;

    const result = await query(
      `INSERT INTO nodes (name, type, ip_address, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, type, ip_address, JSON.stringify(metadata || {})]
    );

    // Invalidate cache
    await cacheHelper.invalidatePattern('nodes:*');

    res.status(201).json({
      success: true,
      message: 'Node created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Create node error:', error);
    res.status(500).json({
      error: 'Failed to create node'
    });
  }
}

// Update node (admin only)
async function updateNode(req, res) {
  try {
    const { id } = req.params;
    const { name, type, ip_address, status, metadata } = req.body;

    const result = await query(
      `UPDATE nodes
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           ip_address = COALESCE($3, ip_address),
           status = COALESCE($4, status),
           metadata = COALESCE($5, metadata),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, type, ip_address, status, metadata ? JSON.stringify(metadata) : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Node not found'
      });
    }

    // Invalidate cache
    await cacheHelper.invalidatePattern('nodes:*');

    res.json({
      success: true,
      message: 'Node updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update node error:', error);
    res.status(500).json({
      error: 'Failed to update node'
    });
  }
}

// Delete node (admin only)
async function deleteNode(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM nodes WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Node not found'
      });
    }

    // Invalidate cache
    await cacheHelper.invalidatePattern('nodes:*');

    res.json({
      success: true,
      message: 'Node deleted successfully'
    });

  } catch (error) {
    console.error('Delete node error:', error);
    res.status(500).json({
      error: 'Failed to delete node'
    });
  }
}

module.exports = {
  getAllNodes,
  getNodeById,
  getNodesByType,
  getNodeStats,
  createNode,
  updateNode,
  deleteNode
};
