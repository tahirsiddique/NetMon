const redis = require('redis');
require('dotenv').config();

// Redis client configuration
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('connect', () => {
  console.log('✓ Redis connected successfully');
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Connect to Redis
(async () => {
  await redisClient.connect();
})();

// Cache helper functions
const cacheHelper = {
  async get(key) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  async set(key, value, expirationSeconds = 3600) {
    try {
      await redisClient.setEx(key, expirationSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  },

  async del(key) {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  },

  async invalidatePattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis pattern invalidation error:', error);
      return false;
    }
  }
};

module.exports = {
  redisClient,
  cacheHelper,
};
