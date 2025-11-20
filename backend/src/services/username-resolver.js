const dns = require('dns').promises;
const ldap = require('ldapjs');
const { query } = require('../config/database');

/**
 * Username Resolver Service
 * Resolves IP addresses to usernames using multiple methods:
 * - Active Directory LDAP queries
 * - DNS reverse lookups
 * - DHCP lease information
 * - Local cache
 */
class UsernameResolver {
  constructor() {
    this.cache = new Map(); // IP -> Username cache
    this.hostnameCache = new Map(); // IP -> Hostname cache
    this.ldapClient = null;
    this.cacheMaxAge = 3600000; // 1 hour in milliseconds

    // Initialize LDAP client if configured
    if (process.env.AD_LDAP_URL && process.env.AD_LDAP_URL !== 'ldap://dc.digiskills.local:389') {
      this.initializeLDAP();
    }
  }

  /**
   * Initialize LDAP client for Active Directory
   */
  initializeLDAP() {
    try {
      this.ldapClient = ldap.createClient({
        url: process.env.AD_LDAP_URL,
        timeout: 5000,
        connectTimeout: 5000,
        idleTimeout: 30000,
        reconnect: true
      });

      this.ldapClient.on('error', (err) => {
        console.error('LDAP client error:', err.message);
      });

      console.log('✓ LDAP client initialized for username resolution');
    } catch (error) {
      console.error('Failed to initialize LDAP client:', error.message);
    }
  }

  /**
   * Resolve IP address to username
   */
  async resolveUsername(ipAddress) {
    try {
      // Check cache first
      const cached = this.getCachedUsername(ipAddress);
      if (cached) {
        return cached;
      }

      // Try multiple resolution methods
      let username = null;

      // Method 1: Query Active Directory via LDAP
      if (this.ldapClient) {
        username = await this.resolveViaLDAP(ipAddress);
        if (username) {
          this.cacheUsername(ipAddress, username);
          return username;
        }
      }

      // Method 2: Query database (from previous collections)
      username = await this.resolveFromDatabase(ipAddress);
      if (username) {
        this.cacheUsername(ipAddress, username);
        return username;
      }

      // Method 3: DNS reverse lookup for hostname
      const hostname = await this.resolveHostname(ipAddress);
      if (hostname && hostname !== ipAddress) {
        // Extract username from hostname if possible
        username = this.extractUsernameFromHostname(hostname);
        if (username) {
          this.cacheUsername(ipAddress, username);
          return username;
        }
      }

      // Fallback: Use IP address
      const fallback = hostname || ipAddress;
      this.cacheUsername(ipAddress, fallback);
      return fallback;

    } catch (error) {
      console.error(`Username resolution error for ${ipAddress}:`, error.message);
      return ipAddress;
    }
  }

  /**
   * Resolve username via Active Directory LDAP
   */
  async resolveViaLDAP(ipAddress) {
    if (!this.ldapClient) {
      return null;
    }

    return new Promise((resolve) => {
      const baseDN = process.env.AD_BASE_DN || 'DC=digiskills,DC=local';

      // Search for computer object with this IP
      const searchOptions = {
        filter: `(&(objectClass=computer)(|(ipHostNumber=${ipAddress})(dNSHostName=*)))`,
        scope: 'sub',
        attributes: ['cn', 'name', 'sAMAccountName', 'description'],
        timeLimit: 5
      };

      this.ldapClient.search(baseDN, searchOptions, (err, res) => {
        if (err) {
          resolve(null);
          return;
        }

        let username = null;

        res.on('searchEntry', (entry) => {
          const obj = entry.object;
          // Use sAMAccountName or cn as username
          username = obj.sAMAccountName || obj.cn || obj.name;

          // Remove $ suffix from computer accounts
          if (username && username.endsWith('$')) {
            username = username.slice(0, -1);
          }
        });

        res.on('error', (err) => {
          console.error('LDAP search error:', err.message);
          resolve(null);
        });

        res.on('end', () => {
          resolve(username);
        });
      });
    });
  }

  /**
   * Resolve username from database (previous records)
   */
  async resolveFromDatabase(ipAddress) {
    try {
      const result = await query(
        `SELECT username, hostname
         FROM internet_usage
         WHERE ip_address = $1
           AND username IS NOT NULL
           AND username != ''
           AND time > NOW() - INTERVAL '7 days'
         ORDER BY time DESC
         LIMIT 1`,
        [ipAddress]
      );

      if (result.rows.length > 0) {
        const username = result.rows[0].username;
        if (username && username !== 'Unknown') {
          return username;
        }
      }

      return null;
    } catch (error) {
      console.error('Database username lookup error:', error.message);
      return null;
    }
  }

  /**
   * Resolve hostname via DNS reverse lookup
   */
  async resolveHostname(ipAddress) {
    try {
      // Check hostname cache first
      const cached = this.getCachedHostname(ipAddress);
      if (cached) {
        return cached;
      }

      // Perform DNS reverse lookup
      const hostnames = await dns.reverse(ipAddress);

      if (hostnames && hostnames.length > 0) {
        const hostname = hostnames[0];
        this.cacheHostname(ipAddress, hostname);
        return hostname;
      }

      return ipAddress;
    } catch (error) {
      // DNS reverse lookup failed, use IP
      return ipAddress;
    }
  }

  /**
   * Extract username from hostname
   * Examples:
   *   DESKTOP-USER123.domain.local -> USER123
   *   PC-JOHNDOE -> JOHNDOE
   *   user-laptop -> user
   */
  extractUsernameFromHostname(hostname) {
    try {
      // Remove domain suffix
      let name = hostname.split('.')[0];

      // Common patterns
      const patterns = [
        /^DESKTOP-(.+)$/i,    // DESKTOP-USERNAME
        /^PC-(.+)$/i,         // PC-USERNAME
        /^LAPTOP-(.+)$/i,     // LAPTOP-USERNAME
        /^(.+)-PC$/i,         // USERNAME-PC
        /^(.+)-LAPTOP$/i,     // USERNAME-LAPTOP
        /^(.+)-DESKTOP$/i     // USERNAME-DESKTOP
      ];

      for (const pattern of patterns) {
        const match = name.match(pattern);
        if (match) {
          return match[1];
        }
      }

      // If no pattern matches, return the hostname
      return name;
    } catch (error) {
      return null;
    }
  }

  /**
   * Batch resolve multiple IP addresses
   */
  async resolveUsernames(ipAddresses) {
    const results = {};

    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < ipAddresses.length; i += batchSize) {
      const batch = ipAddresses.slice(i, i + batchSize);
      const promises = batch.map(ip => this.resolveUsername(ip));
      const resolved = await Promise.all(promises);

      batch.forEach((ip, index) => {
        results[ip] = resolved[index];
      });
    }

    return results;
  }

  /**
   * Get cached username
   */
  getCachedUsername(ipAddress) {
    const cached = this.cache.get(ipAddress);

    if (cached && (Date.now() - cached.timestamp) < this.cacheMaxAge) {
      return cached.username;
    }

    // Cache expired
    if (cached) {
      this.cache.delete(ipAddress);
    }

    return null;
  }

  /**
   * Cache username
   */
  cacheUsername(ipAddress, username) {
    this.cache.set(ipAddress, {
      username,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached hostname
   */
  getCachedHostname(ipAddress) {
    const cached = this.hostnameCache.get(ipAddress);

    if (cached && (Date.now() - cached.timestamp) < this.cacheMaxAge) {
      return cached.hostname;
    }

    if (cached) {
      this.hostnameCache.delete(ipAddress);
    }

    return null;
  }

  /**
   * Cache hostname
   */
  cacheHostname(ipAddress, hostname) {
    this.hostnameCache.set(ipAddress, {
      hostname,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all caches
   */
  clearCache() {
    const usernameCount = this.cache.size;
    const hostnameCount = this.hostnameCache.size;

    this.cache.clear();
    this.hostnameCache.clear();

    return {
      usernamesCleared: usernameCount,
      hostnamesCleared: hostnameCount
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      usernameCache: this.cache.size,
      hostnameCache: this.hostnameCache.size,
      maxAge: this.cacheMaxAge / 1000 // in seconds
    };
  }

  /**
   * Close LDAP connection
   */
  close() {
    if (this.ldapClient) {
      this.ldapClient.unbind();
    }
  }
}

module.exports = new UsernameResolver();
