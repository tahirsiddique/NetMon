const snmp = require('net-snmp');

/**
 * SNMP Collector Service
 * Collects metrics from network devices using SNMP protocol
 * Supports Dell servers (OpenManage), switches (IF-MIB), firewalls
 */
class SNMPCollector {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Main entry point for collecting device metrics
   */
  async collectDeviceMetrics(device) {
    try {
      const session = this.getSession(device.ip_address, device.metadata?.snmp_community || 'public');

      let metrics;
      switch(device.type) {
        case 'dell_server':
          metrics = await this.collectDellServerMetrics(session, device);
          break;
        case 'dell_switch':
          metrics = await this.collectSwitchMetrics(session, device);
          break;
        case 'fortigate':
          metrics = await this.collectFortiGateMetrics(session, device);
          break;
        case 'pfsense':
          metrics = await this.collectPfSenseMetrics(session, device);
          break;
        case 'esxi':
          metrics = await this.collectESXiMetrics(session, device);
          break;
        default:
          metrics = await this.collectGenericMetrics(session, device);
      }

      return {
        success: true,
        timestamp: new Date(),
        metrics
      };

    } catch (error) {
      console.error(`SNMP collection failed for ${device.name}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Collect metrics from Dell servers using OpenManage SNMP OIDs
   */
  async collectDellServerMetrics(session, device) {
    // Dell OpenManage Enterprise SNMP OIDs
    const oids = {
      systemStatus: '1.3.6.1.4.1.674.10892.5.2.1.0',           // Overall system health
      powerSupplyStatus: '1.3.6.1.4.1.674.10892.5.4.600.12.1.5.1.1', // PSU status
      temperatureReading: '1.3.6.1.4.1.674.10892.5.4.700.20.1.6.1.1', // Temperature probe
      fanStatus: '1.3.6.1.4.1.674.10892.5.4.700.12.1.5.1.1',   // Fan status
      physicalDiskState: '1.3.6.1.4.1.674.10892.5.5.1.20.130.4.1.4.1', // RAID disk
      // Standard system metrics
      cpuLoad: '1.3.6.1.4.1.2021.11.9.0',                      // CPU load (UCD-SNMP-MIB)
      memoryTotal: '1.3.6.1.4.1.2021.4.5.0',                   // Total memory
      memoryAvailable: '1.3.6.1.4.1.2021.4.6.0',               // Available memory
    };

    try {
      const results = await this.bulkGet(session, Object.values(oids));

      // Parse results
      const systemStatus = this.mapDellStatus(results[0]);
      const psuStatus = this.mapDellStatus(results[1]);
      const temperature = results[2] ? parseInt(results[2]) / 10 : null; // Convert to Celsius
      const fanStatus = this.mapDellStatus(results[3]);
      const diskStatus = this.mapDellStatus(results[4]);
      const cpuLoad = results[5] ? parseInt(results[5]) : null;
      const memTotal = results[6] ? parseInt(results[6]) : null;
      const memAvailable = results[7] ? parseInt(results[7]) : null;

      const metrics = {
        system_health: systemStatus,
        psu_status: psuStatus,
        temperature_celsius: temperature,
        fan_status: fanStatus,
        disk_status: diskStatus,
        cpu_usage_percent: cpuLoad,
        memory_total_mb: memTotal,
        memory_available_mb: memAvailable,
        memory_usage_percent: memTotal && memAvailable ?
          Math.round(((memTotal - memAvailable) / memTotal) * 100) : null
      };

      return metrics;
    } catch (error) {
      console.error('Dell server metrics collection error:', error.message);
      // Try to get at least basic system info
      return await this.collectGenericMetrics(session, device);
    }
  }

  /**
   * Collect metrics from network switches using IF-MIB
   */
  async collectSwitchMetrics(session, device) {
    // Standard IF-MIB OIDs for network interfaces
    const baseOids = {
      ifNumber: '1.3.6.1.2.1.2.1.0',                // Number of interfaces
      sysUpTime: '1.3.6.1.2.1.1.3.0',               // System uptime
    };

    try {
      // Get number of interfaces and uptime
      const [ifNumber, sysUpTime] = await this.bulkGet(session, Object.values(baseOids));

      // Get interface statistics for first 10 interfaces (typical switch ports)
      const interfaces = [];
      const maxInterfaces = Math.min(parseInt(ifNumber) || 10, 10);

      for (let i = 1; i <= maxInterfaces; i++) {
        try {
          const ifStats = await this.bulkGet(session, [
            `1.3.6.1.2.1.2.2.1.2.${i}`,   // ifDescr
            `1.3.6.1.2.1.2.2.1.5.${i}`,   // ifSpeed
            `1.3.6.1.2.1.2.2.1.8.${i}`,   // ifOperStatus
            `1.3.6.1.2.1.2.2.1.10.${i}`,  // ifInOctets
            `1.3.6.1.2.1.2.2.1.16.${i}`,  // ifOutOctets
          ]);

          interfaces.push({
            index: i,
            description: ifStats[0] ? ifStats[0].toString() : `Interface ${i}`,
            speed_bps: parseInt(ifStats[1]) || 0,
            status: parseInt(ifStats[2]) === 1 ? 'up' : 'down',
            bytes_in: parseInt(ifStats[3]) || 0,
            bytes_out: parseInt(ifStats[4]) || 0,
          });
        } catch (ifError) {
          console.error(`Error collecting interface ${i}:`, ifError.message);
        }
      }

      // Calculate total bandwidth
      const totalBytesIn = interfaces.reduce((sum, iface) => sum + iface.bytes_in, 0);
      const totalBytesOut = interfaces.reduce((sum, iface) => sum + iface.bytes_out, 0);
      const activeInterfaces = interfaces.filter(iface => iface.status === 'up').length;

      return {
        uptime_seconds: parseInt(sysUpTime) / 100, // Convert to seconds
        interface_count: interfaces.length,
        interfaces_up: activeInterfaces,
        interfaces_down: interfaces.length - activeInterfaces,
        total_bytes_in: totalBytesIn,
        total_bytes_out: totalBytesOut,
        interfaces: interfaces
      };

    } catch (error) {
      console.error('Switch metrics collection error:', error.message);
      throw error;
    }
  }

  /**
   * Collect metrics from FortiGate firewall
   */
  async collectFortiGateMetrics(session, device) {
    // FortiGate SNMP OIDs
    const oids = {
      cpuUsage: '1.3.6.1.4.1.12356.101.4.1.3.0',     // CPU usage
      memUsage: '1.3.6.1.4.1.12356.101.4.1.4.0',     // Memory usage
      sessionsActive: '1.3.6.1.4.1.12356.101.4.1.8.0', // Active sessions
      sysUpTime: '1.3.6.1.2.1.1.3.0',                 // Uptime
    };

    try {
      const [cpu, memory, sessions, uptime] = await this.bulkGet(session, Object.values(oids));

      return {
        cpu_usage_percent: parseInt(cpu) || 0,
        memory_usage_percent: parseInt(memory) || 0,
        active_sessions: parseInt(sessions) || 0,
        uptime_seconds: parseInt(uptime) / 100,
      };
    } catch (error) {
      console.error('FortiGate metrics collection error:', error.message);
      return await this.collectGenericMetrics(session, device);
    }
  }

  /**
   * Collect metrics from pfSense firewall
   */
  async collectPfSenseMetrics(session, device) {
    // pfSense uses standard MIBs
    const oids = {
      cpuLoad: '1.3.6.1.4.1.2021.11.9.0',          // CPU load
      memTotal: '1.3.6.1.4.1.2021.4.5.0',          // Total memory
      memAvailable: '1.3.6.1.4.1.2021.4.6.0',      // Available memory
      sysUpTime: '1.3.6.1.2.1.1.3.0',               // Uptime
    };

    try {
      const [cpu, memTotal, memAvail, uptime] = await this.bulkGet(session, Object.values(oids));

      const memUsagePercent = memTotal && memAvail ?
        Math.round(((memTotal - memAvail) / memTotal) * 100) : 0;

      return {
        cpu_usage_percent: parseInt(cpu) || 0,
        memory_total_mb: parseInt(memTotal) || 0,
        memory_available_mb: parseInt(memAvail) || 0,
        memory_usage_percent: memUsagePercent,
        uptime_seconds: parseInt(uptime) / 100,
      };
    } catch (error) {
      console.error('pfSense metrics collection error:', error.message);
      return await this.collectGenericMetrics(session, device);
    }
  }

  /**
   * Collect metrics from VMware ESXi host
   */
  async collectESXiMetrics(session, device) {
    // VMware ESXi SNMP OIDs
    const oids = {
      cpuUsage: '1.3.6.1.4.1.6876.1.2.0',           // CPU usage
      memUsage: '1.3.6.1.4.1.6876.1.3.0',           // Memory usage
      sysUpTime: '1.3.6.1.2.1.1.3.0',                // Uptime
    };

    try {
      const [cpu, memory, uptime] = await this.bulkGet(session, Object.values(oids));

      return {
        cpu_usage_percent: parseInt(cpu) || 0,
        memory_usage_percent: parseInt(memory) || 0,
        uptime_seconds: parseInt(uptime) / 100,
      };
    } catch (error) {
      console.error('ESXi metrics collection error:', error.message);
      return await this.collectGenericMetrics(session, device);
    }
  }

  /**
   * Collect generic system metrics using standard MIBs
   */
  async collectGenericMetrics(session, device) {
    const oids = {
      sysDescr: '1.3.6.1.2.1.1.1.0',                // System description
      sysUpTime: '1.3.6.1.2.1.1.3.0',               // Uptime
      sysName: '1.3.6.1.2.1.1.5.0',                 // System name
    };

    try {
      const [sysDescr, sysUpTime, sysName] = await this.bulkGet(session, Object.values(oids));

      return {
        system_description: sysDescr ? sysDescr.toString() : 'Unknown',
        system_name: sysName ? sysName.toString() : device.name,
        uptime_seconds: parseInt(sysUpTime) / 100,
        status: 'up'
      };
    } catch (error) {
      console.error('Generic metrics collection error:', error.message);
      throw error;
    }
  }

  /**
   * Map Dell status codes to human-readable status
   */
  mapDellStatus(value) {
    if (!value) return 'unknown';

    const statusMap = {
      1: 'other',
      2: 'unknown',
      3: 'ok',
      4: 'non-critical',
      5: 'critical',
      6: 'non-recoverable'
    };

    return statusMap[parseInt(value)] || 'unknown';
  }

  /**
   * Get or create SNMP session for a device
   */
  getSession(host, community) {
    const key = `${host}:${community}`;

    if (!this.sessions.has(key)) {
      const session = snmp.createSession(host, community, {
        timeout: 5000,
        retries: 2,
        version: snmp.Version2c,
        transport: 'udp4'
      });

      this.sessions.set(key, session);
    }

    return this.sessions.get(key);
  }

  /**
   * Get a single OID value
   */
  async get(session, oid) {
    return new Promise((resolve, reject) => {
      session.get([oid], (error, varbinds) => {
        if (error) {
          reject(error);
        } else if (varbinds[0].type === snmp.ObjectType.NoSuchObject) {
          resolve(null);
        } else {
          resolve(varbinds[0].value);
        }
      });
    });
  }

  /**
   * Get multiple OID values at once
   */
  async bulkGet(session, oids) {
    return new Promise((resolve, reject) => {
      session.get(oids, (error, varbinds) => {
        if (error) {
          reject(error);
        } else {
          const values = varbinds.map(vb => {
            if (vb.type === snmp.ObjectType.NoSuchObject) {
              return null;
            }
            return vb.value;
          });
          resolve(values);
        }
      });
    });
  }

  /**
   * Walk an OID tree (for tables)
   */
  async walkTable(session, oid) {
    const results = [];

    return new Promise((resolve, reject) => {
      const maxRepetitions = 20;

      session.subtree(oid, maxRepetitions, (varbinds) => {
        for (const vb of varbinds) {
          if (vb.type !== snmp.ObjectType.NoSuchObject) {
            results.push(vb.value);
          }
        }
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  }

  /**
   * Close all SNMP sessions
   */
  closeAllSessions() {
    for (const [key, session] of this.sessions.entries()) {
      try {
        session.close();
      } catch (error) {
        console.error(`Error closing session ${key}:`, error.message);
      }
    }
    this.sessions.clear();
  }
}

module.exports = SNMPCollector;
