const axios = require('axios');
const { query } = require('../../config/database');

/**
 * Zabbix API Integration Service
 *
 * Connects to existing Zabbix server to retrieve internet link monitoring data.
 * Synchronizes link status, bandwidth usage, and alerts to local database.
 */
class ZabbixIntegration {
  constructor() {
    this.zabbixUrl = process.env.ZABBIX_URL || 'http://localhost/zabbix/api_jsonrpc.php';
    this.zabbixUser = process.env.ZABBIX_USER;
    this.zabbixPassword = process.env.ZABBIX_PASSWORD;
    this.authToken = null;
    this.tokenExpiry = null;
    this.axiosInstance = axios.create({
      baseURL: this.zabbixUrl,
      headers: {
        'Content-Type': 'application/json-rpc'
      },
      timeout: 10000
    });
  }

  /**
   * Authenticate with Zabbix API
   */
  async authenticate() {
    try {
      // Check if we have a valid token
      if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.authToken;
      }

      if (!this.zabbixUser || !this.zabbixPassword) {
        throw new Error('Zabbix credentials not configured. Set ZABBIX_USER and ZABBIX_PASSWORD in .env');
      }

      const response = await this.axiosInstance.post('', {
        jsonrpc: '2.0',
        method: 'user.login',
        params: {
          username: this.zabbixUser,
          password: this.zabbixPassword
        },
        id: 1
      });

      if (response.data.error) {
        throw new Error(`Zabbix authentication failed: ${response.data.error.data}`);
      }

      this.authToken = response.data.result;
      // Token typically valid for 1 hour, refresh after 50 minutes
      this.tokenExpiry = Date.now() + (50 * 60 * 1000);

      console.log('✓ Authenticated with Zabbix API');
      return this.authToken;

    } catch (error) {
      console.error('Zabbix authentication error:', error.message);
      throw error;
    }
  }

  /**
   * Make authenticated API call to Zabbix
   */
  async apiCall(method, params = {}) {
    try {
      const token = await this.authenticate();

      const response = await this.axiosInstance.post('', {
        jsonrpc: '2.0',
        method: method,
        params: params,
        auth: token,
        id: Math.floor(Math.random() * 100000)
      });

      if (response.data.error) {
        throw new Error(`Zabbix API error: ${response.data.error.data || response.data.error.message}`);
      }

      return response.data.result;

    } catch (error) {
      // If authentication fails, clear token and retry once
      if (error.message.includes('Session terminated') || error.message.includes('Not authorized')) {
        this.authToken = null;
        this.tokenExpiry = null;

        // Retry once
        const token = await this.authenticate();
        const response = await this.axiosInstance.post('', {
          jsonrpc: '2.0',
          method: method,
          params: params,
          auth: token,
          id: Math.floor(Math.random() * 100000)
        });

        if (response.data.error) {
          throw new Error(`Zabbix API error: ${response.data.error.data || response.data.error.message}`);
        }

        return response.data.result;
      }

      throw error;
    }
  }

  /**
   * Get all internet link hosts from Zabbix
   * Looks for hosts in "Internet Links" group or with "link" tag
   */
  async getInternetLinkHosts() {
    try {
      // First, try to find "Internet Links" host group
      const groups = await this.apiCall('hostgroup.get', {
        output: ['groupid', 'name'],
        filter: {
          name: ['Internet Links', 'WAN Links', 'Internet']
        }
      });

      let hosts = [];

      if (groups && groups.length > 0) {
        // Get hosts from the group
        const groupId = groups[0].groupid;
        hosts = await this.apiCall('host.get', {
          output: ['hostid', 'host', 'name', 'status'],
          groupids: [groupId],
          selectInterfaces: ['ip', 'dns', 'port', 'type'],
          selectTags: ['tag', 'value']
        });
      } else {
        // Fallback: get all hosts with "internet" or "wan" in name
        hosts = await this.apiCall('host.get', {
          output: ['hostid', 'host', 'name', 'status'],
          search: {
            name: ['internet', 'wan', 'link', 'isp']
          },
          selectInterfaces: ['ip', 'dns', 'port', 'type'],
          selectTags: ['tag', 'value']
        });
      }

      return hosts.map(host => ({
        zabbix_host_id: host.hostid,
        host_name: host.host,
        display_name: host.name,
        status: host.status === '0' ? 'enabled' : 'disabled',
        ip_address: host.interfaces && host.interfaces[0] ? host.interfaces[0].ip : null,
        tags: host.tags || []
      }));

    } catch (error) {
      console.error('Failed to get internet link hosts:', error.message);
      return [];
    }
  }

  /**
   * Get interface items (bandwidth, status) for a host
   */
  async getHostItems(hostId) {
    try {
      const items = await this.apiCall('item.get', {
        output: ['itemid', 'name', 'key_', 'lastvalue', 'units', 'lastclock'],
        hostids: [hostId],
        search: {
          key_: ['net.if', 'icmpping', 'status', 'ifOperStatus']
        },
        selectTriggers: ['triggerid', 'description', 'priority', 'value'],
        filter: {
          status: 0 // Only enabled items
        }
      });

      return items.map(item => ({
        item_id: item.itemid,
        name: item.name,
        key: item.key_,
        last_value: item.lastvalue,
        units: item.units,
        last_check: new Date(item.lastclock * 1000),
        has_trigger: item.triggers && item.triggers.length > 0,
        trigger_status: item.triggers && item.triggers[0] ? item.triggers[0].value : null
      }));

    } catch (error) {
      console.error(`Failed to get items for host ${hostId}:`, error.message);
      return [];
    }
  }

  /**
   * Get bandwidth usage for an interface
   */
  async getInterfaceBandwidth(hostId, interfaceName = 'eth0') {
    try {
      // Get incoming traffic
      const incomingItems = await this.apiCall('item.get', {
        output: ['itemid', 'lastvalue', 'lastclock'],
        hostids: [hostId],
        search: {
          key_: `net.if.in[${interfaceName}]`
        }
      });

      // Get outgoing traffic
      const outgoingItems = await this.apiCall('item.get', {
        output: ['itemid', 'lastvalue', 'lastclock'],
        hostids: [hostId],
        search: {
          key_: `net.if.out[${interfaceName}]`
        }
      });

      const bandwidth = {
        interface: interfaceName,
        incoming_bps: 0,
        outgoing_bps: 0,
        total_bps: 0,
        last_update: null
      };

      if (incomingItems && incomingItems.length > 0) {
        bandwidth.incoming_bps = parseFloat(incomingItems[0].lastvalue) || 0;
        bandwidth.last_update = new Date(incomingItems[0].lastclock * 1000);
      }

      if (outgoingItems && outgoingItems.length > 0) {
        bandwidth.outgoing_bps = parseFloat(outgoingItems[0].lastvalue) || 0;
        if (!bandwidth.last_update) {
          bandwidth.last_update = new Date(outgoingItems[0].lastclock * 1000);
        }
      }

      bandwidth.total_bps = bandwidth.incoming_bps + bandwidth.outgoing_bps;

      return bandwidth;

    } catch (error) {
      console.error(`Failed to get bandwidth for host ${hostId}:`, error.message);
      return null;
    }
  }

  /**
   * Get link status (up/down) via ICMP ping
   */
  async getLinkStatus(hostId) {
    try {
      const items = await this.apiCall('item.get', {
        output: ['itemid', 'lastvalue', 'lastclock'],
        hostids: [hostId],
        search: {
          key_: 'icmpping'
        }
      });

      if (items && items.length > 0) {
        const pingStatus = parseInt(items[0].lastvalue);
        return {
          is_up: pingStatus === 1,
          last_check: new Date(items[0].lastclock * 1000),
          response_time: null // Could add icmppingsec for response time
        };
      }

      return {
        is_up: false,
        last_check: new Date(),
        response_time: null
      };

    } catch (error) {
      console.error(`Failed to get link status for host ${hostId}:`, error.message);
      return null;
    }
  }

  /**
   * Get active problems (alerts) for internet links
   */
  async getActiveProblems() {
    try {
      const problems = await this.apiCall('problem.get', {
        output: ['eventid', 'objectid', 'name', 'severity', 'clock', 'acknowledged'],
        selectHosts: ['hostid', 'host', 'name'],
        selectTags: ['tag', 'value'],
        recent: true, // Only active problems
        sortfield: ['clock'],
        sortorder: 'DESC'
      });

      return problems.map(problem => ({
        event_id: problem.eventid,
        trigger_id: problem.objectid,
        description: problem.name,
        severity: this.mapSeverity(problem.severity),
        timestamp: new Date(problem.clock * 1000),
        acknowledged: problem.acknowledged === '1',
        host: problem.hosts && problem.hosts[0] ? problem.hosts[0].name : 'Unknown',
        host_id: problem.hosts && problem.hosts[0] ? problem.hosts[0].hostid : null
      }));

    } catch (error) {
      console.error('Failed to get active problems:', error.message);
      return [];
    }
  }

  /**
   * Map Zabbix severity to readable format
   */
  mapSeverity(severityCode) {
    const severities = {
      0: 'Not classified',
      1: 'Information',
      2: 'Warning',
      3: 'Average',
      4: 'High',
      5: 'Disaster'
    };
    return severities[severityCode] || 'Unknown';
  }

  /**
   * Synchronize internet link data to local database
   */
  async syncInternetLinks() {
    try {
      console.log('Starting Zabbix internet links synchronization...');

      const hosts = await this.getInternetLinkHosts();

      if (hosts.length === 0) {
        console.log('No internet link hosts found in Zabbix');
        return { synced: 0, errors: 0 };
      }

      console.log(`Found ${hosts.length} internet link hosts`);

      let synced = 0;
      let errors = 0;

      for (const host of hosts) {
        try {
          // Get link status
          const status = await this.getLinkStatus(host.zabbix_host_id);

          // Get bandwidth (try common interface names)
          let bandwidth = null;
          for (const ifName of ['eth0', 'ens3', 'wan', 'pppoe-out1']) {
            bandwidth = await this.getInterfaceBandwidth(host.zabbix_host_id, ifName);
            if (bandwidth && bandwidth.total_bps > 0) {
              break;
            }
          }

          // Upsert to database
          await query(`
            INSERT INTO zabbix_internet_links (
              zabbix_host_id,
              link_name,
              link_type,
              ip_address,
              status,
              bandwidth_in,
              bandwidth_out,
              last_seen,
              metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (zabbix_host_id) DO UPDATE SET
              link_name = EXCLUDED.link_name,
              ip_address = EXCLUDED.ip_address,
              status = EXCLUDED.status,
              bandwidth_in = EXCLUDED.bandwidth_in,
              bandwidth_out = EXCLUDED.bandwidth_out,
              last_seen = EXCLUDED.last_seen,
              metadata = EXCLUDED.metadata,
              updated_at = NOW()
          `, [
            host.zabbix_host_id,
            host.display_name || host.host_name,
            this.detectLinkType(host),
            host.ip_address,
            status ? (status.is_up ? 'up' : 'down') : 'unknown',
            bandwidth ? Math.round(bandwidth.incoming_bps) : null,
            bandwidth ? Math.round(bandwidth.outgoing_bps) : null,
            status ? status.last_check : new Date(),
            JSON.stringify({
              host_name: host.host_name,
              tags: host.tags,
              zabbix_status: host.status
            })
          ]);

          synced++;

        } catch (error) {
          console.error(`Error syncing host ${host.host_name}:`, error.message);
          errors++;
        }
      }

      console.log(`✓ Synced ${synced} internet links (${errors} errors)`);

      return { synced, errors, total: hosts.length };

    } catch (error) {
      console.error('Internet links synchronization failed:', error.message);
      throw error;
    }
  }

  /**
   * Detect link type based on host name or tags
   */
  detectLinkType(host) {
    const name = (host.display_name || host.host_name).toLowerCase();

    if (name.includes('fiber') || name.includes('ftth')) return 'fiber';
    if (name.includes('dsl') || name.includes('adsl')) return 'dsl';
    if (name.includes('wireless') || name.includes('wifi') || name.includes('lte') || name.includes('4g')) return 'wireless';
    if (name.includes('satellite')) return 'satellite';
    if (name.includes('backup') || name.includes('failover')) return 'backup';

    // Check tags
    for (const tag of host.tags) {
      if (tag.tag === 'link_type') {
        return tag.value;
      }
    }

    return 'unknown';
  }

  /**
   * Get historical bandwidth data for a link
   */
  async getHistoricalBandwidth(hostId, itemKey, timeFrom, timeTill) {
    try {
      // Get item ID first
      const items = await this.apiCall('item.get', {
        output: ['itemid'],
        hostids: [hostId],
        search: { key_: itemKey }
      });

      if (!items || items.length === 0) {
        return [];
      }

      const itemId = items[0].itemid;

      // Get history
      const history = await this.apiCall('history.get', {
        output: 'extend',
        itemids: [itemId],
        time_from: Math.floor(timeFrom.getTime() / 1000),
        time_till: Math.floor(timeTill.getTime() / 1000),
        sortfield: 'clock',
        sortorder: 'ASC'
      });

      return history.map(h => ({
        timestamp: new Date(h.clock * 1000),
        value: parseFloat(h.value)
      }));

    } catch (error) {
      console.error(`Failed to get historical bandwidth:`, error.message);
      return [];
    }
  }

  /**
   * Test Zabbix connection and permissions
   */
  async testConnection() {
    try {
      await this.authenticate();

      // Try to get API version
      const version = await this.apiCall('apiinfo.version', {});

      // Try to get at least one host
      const hosts = await this.apiCall('host.get', {
        output: ['hostid', 'host'],
        limit: 1
      });

      return {
        success: true,
        version: version,
        authenticated: true,
        can_read_hosts: hosts.length > 0,
        message: `Connected to Zabbix ${version}`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect to Zabbix API'
      };
    }
  }
}

// Singleton instance
const zabbixIntegration = new ZabbixIntegration();

module.exports = zabbixIntegration;
