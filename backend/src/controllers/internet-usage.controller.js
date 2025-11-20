const internetUsageService = require('../services/internet-usage-service');
const usernameResolver = require('../services/username-resolver');

/**
 * Get top internet users
 */
async function getTopUsers(req, res) {
  try {
    const { range = 'today', limit = 20 } = req.query;

    const users = await internetUsageService.getTopUsers(range, parseInt(limit));

    res.json({
      success: true,
      data: users,
      range
    });

  } catch (error) {
    console.error('Get top users error:', error);
    res.status(500).json({
      error: 'Failed to retrieve top users'
    });
  }
}

/**
 * Get usage for specific user
 */
async function getUserUsage(req, res) {
  try {
    const { username } = req.params;
    const { range = 'today' } = req.query;

    const usage = await internetUsageService.getUserUsage(username, range);

    res.json({
      success: true,
      data: usage,
      range
    });

  } catch (error) {
    console.error('Get user usage error:', error);
    res.status(500).json({
      error: 'Failed to retrieve user usage'
    });
  }
}

/**
 * Get usage by protocol
 */
async function getUsageByProtocol(req, res) {
  try {
    const { range = 'today' } = req.query;

    const protocols = await internetUsageService.getUsageByProtocol(range);

    res.json({
      success: true,
      data: protocols,
      range
    });

  } catch (error) {
    console.error('Get protocol usage error:', error);
    res.status(500).json({
      error: 'Failed to retrieve protocol usage'
    });
  }
}

/**
 * Get usage time series for charts
 */
async function getUsageTimeSeries(req, res) {
  try {
    const { range = 'today', granularity = 'hour' } = req.query;

    const timeSeries = await internetUsageService.getUsageTimeSeries(range, granularity);

    res.json({
      success: true,
      data: timeSeries,
      range,
      granularity
    });

  } catch (error) {
    console.error('Get usage time series error:', error);
    res.status(500).json({
      error: 'Failed to retrieve usage time series'
    });
  }
}

/**
 * Get top destinations
 */
async function getTopDestinations(req, res) {
  try {
    const { range = 'today', limit = 20 } = req.query;

    const destinations = await internetUsageService.getTopDestinations(range, parseInt(limit));

    res.json({
      success: true,
      data: destinations,
      range
    });

  } catch (error) {
    console.error('Get top destinations error:', error);
    res.status(500).json({
      error: 'Failed to retrieve top destinations'
    });
  }
}

/**
 * Get overall usage statistics
 */
async function getOverallStats(req, res) {
  try {
    const { range = 'today' } = req.query;

    const stats = await internetUsageService.getOverallStats(range);

    res.json({
      success: true,
      data: stats,
      range
    });

  } catch (error) {
    console.error('Get overall stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve overall statistics'
    });
  }
}

/**
 * Search users
 */
async function searchUsers(req, res) {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        error: 'Search term must be at least 2 characters'
      });
    }

    const users = await internetUsageService.searchUsers(q);

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      error: 'Failed to search users'
    });
  }
}

/**
 * Export usage data to CSV
 */
async function exportCSV(req, res) {
  try {
    const { range = 'today', username } = req.query;

    const csv = await internetUsageService.exportToCSV(range, username);

    const filename = username
      ? `usage_${username}_${range}.csv`
      : `usage_${range}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({
      error: 'Failed to export data'
    });
  }
}

/**
 * Get resolver cache statistics
 */
async function getResolverStats(req, res) {
  try {
    const stats = usernameResolver.getCacheStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get resolver stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve resolver statistics'
    });
  }
}

/**
 * Clear resolver cache (admin only)
 */
async function clearResolverCache(req, res) {
  try {
    const result = usernameResolver.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      data: result
    });

  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      error: 'Failed to clear cache'
    });
  }
}

module.exports = {
  getTopUsers,
  getUserUsage,
  getUsageByProtocol,
  getUsageTimeSeries,
  getTopDestinations,
  getOverallStats,
  searchUsers,
  exportCSV,
  getResolverStats,
  clearResolverCache
};
