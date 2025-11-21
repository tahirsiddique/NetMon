const WmiClient = require('wmi-client');

/**
 * WMI Collector Service
 * Collects metrics from Windows servers using WMI protocol
 * Monitors CPU, memory, disk, and Windows services
 */
class WMICollector {
  constructor() {
    this.clients = new Map();
  }

  /**
   * Main entry point for collecting Windows metrics
   */
  async collectWindowsMetrics(device) {
    try {
      const client = await this.getClient(device);

      // Collect all metrics in parallel
      const [osInfo, cpu, memory, services, disks, uptime] = await Promise.all([
        this.queryOSInfo(client),
        this.queryCPUUsage(client),
        this.queryMemoryUsage(client),
        this.queryWindowsServices(client, device.metadata?.monitored_services || ['NTDS', 'DNS', 'DHCP']),
        this.queryDiskSpace(client),
        this.queryUptime(client)
      ]);

      return {
        success: true,
        timestamp: new Date(),
        metrics: {
          os_info: osInfo,
          cpu_usage_percent: cpu,
          memory: memory,
          services: services,
          disks: disks,
          uptime_hours: uptime
        }
      };

    } catch (error) {
      console.error(`WMI collection failed for ${device.name}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Query Windows operating system information
   */
  async queryOSInfo(client) {
    try {
      const query = 'SELECT Caption, Version, BuildNumber, OSArchitecture, LastBootUpTime FROM Win32_OperatingSystem';
      const result = await client.query(query);

      if (result && result.length > 0) {
        return {
          caption: result[0].Caption,
          version: result[0].Version,
          build: result[0].BuildNumber,
          architecture: result[0].OSArchitecture,
          last_boot: result[0].LastBootUpTime
        };
      }

      return null;
    } catch (error) {
      console.error('OS info query error:', error.message);
      return null;
    }
  }

  /**
   * Query CPU usage percentage
   */
  async queryCPUUsage(client) {
    try {
      const query = 'SELECT LoadPercentage FROM Win32_Processor';
      const result = await client.query(query);

      if (result && result.length > 0) {
        // If multiple CPUs, return average
        const totalLoad = result.reduce((sum, cpu) => sum + (parseInt(cpu.LoadPercentage) || 0), 0);
        return Math.round(totalLoad / result.length);
      }

      return 0;
    } catch (error) {
      console.error('CPU usage query error:', error.message);
      return 0;
    }
  }

  /**
   * Query memory usage
   */
  async queryMemoryUsage(client) {
    try {
      const query = 'SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem';
      const result = await client.query(query);

      if (result && result.length > 0) {
        const totalKB = parseInt(result[0].TotalVisibleMemorySize) || 0;
        const freeKB = parseInt(result[0].FreePhysicalMemory) || 0;
        const usedKB = totalKB - freeKB;

        return {
          total_mb: Math.round(totalKB / 1024),
          free_mb: Math.round(freeKB / 1024),
          used_mb: Math.round(usedKB / 1024),
          usage_percent: totalKB > 0 ? Math.round((usedKB / totalKB) * 100) : 0
        };
      }

      return {
        total_mb: 0,
        free_mb: 0,
        used_mb: 0,
        usage_percent: 0
      };
    } catch (error) {
      console.error('Memory usage query error:', error.message);
      return {
        total_mb: 0,
        free_mb: 0,
        used_mb: 0,
        usage_percent: 0
      };
    }
  }

  /**
   * Query Windows services status
   */
  async queryWindowsServices(client, serviceNames) {
    const services = [];

    for (const serviceName of serviceNames) {
      try {
        const query = `SELECT Name, DisplayName, State, Status, StartMode FROM Win32_Service WHERE Name = '${serviceName}'`;
        const result = await client.query(query);

        if (result && result.length > 0) {
          services.push({
            name: result[0].Name,
            display_name: result[0].DisplayName,
            state: result[0].State,          // Running, Stopped, etc.
            status: result[0].Status,        // OK, Error, etc.
            start_mode: result[0].StartMode  // Auto, Manual, Disabled
          });
        } else {
          services.push({
            name: serviceName,
            display_name: serviceName,
            state: 'NotFound',
            status: 'Unknown',
            start_mode: 'Unknown'
          });
        }
      } catch (error) {
        console.error(`Error querying service ${serviceName}:`, error.message);
        services.push({
          name: serviceName,
          display_name: serviceName,
          state: 'Error',
          status: 'Error',
          start_mode: 'Unknown'
        });
      }
    }

    return services;
  }

  /**
   * Query disk space for all logical drives
   */
  async queryDiskSpace(client) {
    try {
      const query = 'SELECT DeviceID, Size, FreeSpace, FileSystem FROM Win32_LogicalDisk WHERE DriveType = 3';
      const result = await client.query(query);

      if (result && result.length > 0) {
        return result.map(disk => {
          const sizeBytes = parseInt(disk.Size) || 0;
          const freeBytes = parseInt(disk.FreeSpace) || 0;
          const usedBytes = sizeBytes - freeBytes;

          return {
            drive: disk.DeviceID,
            filesystem: disk.FileSystem,
            total_gb: Math.round(sizeBytes / (1024 ** 3)),
            free_gb: Math.round(freeBytes / (1024 ** 3)),
            used_gb: Math.round(usedBytes / (1024 ** 3)),
            usage_percent: sizeBytes > 0 ? Math.round((usedBytes / sizeBytes) * 100) : 0
          };
        });
      }

      return [];
    } catch (error) {
      console.error('Disk space query error:', error.message);
      return [];
    }
  }

  /**
   * Query system uptime
   */
  async queryUptime(client) {
    try {
      const query = 'SELECT LastBootUpTime FROM Win32_OperatingSystem';
      const result = await client.query(query);

      if (result && result.length > 0) {
        const lastBoot = result[0].LastBootUpTime;
        // WMI returns datetime in format: 20250101120000.000000+000
        const bootTime = this.parseWMIDateTime(lastBoot);
        const now = new Date();
        const uptimeMs = now - bootTime;
        const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));

        return uptimeHours;
      }

      return 0;
    } catch (error) {
      console.error('Uptime query error:', error.message);
      return 0;
    }
  }

  /**
   * Query network adapter statistics
   */
  async queryNetworkAdapters(client) {
    try {
      const query = 'SELECT Name, BytesReceivedPerSec, BytesSentPerSec FROM Win32_PerfFormattedData_Tcpip_NetworkInterface';
      const result = await client.query(query);

      if (result && result.length > 0) {
        return result.map(adapter => ({
          name: adapter.Name,
          bytes_received_per_sec: parseInt(adapter.BytesReceivedPerSec) || 0,
          bytes_sent_per_sec: parseInt(adapter.BytesSentPerSec) || 0
        }));
      }

      return [];
    } catch (error) {
      console.error('Network adapters query error:', error.message);
      return [];
    }
  }

  /**
   * Parse WMI datetime format to JavaScript Date
   */
  parseWMIDateTime(wmiDate) {
    try {
      // WMI format: 20250101120000.000000+000
      const year = wmiDate.substr(0, 4);
      const month = wmiDate.substr(4, 2) - 1; // JS months are 0-indexed
      const day = wmiDate.substr(6, 2);
      const hour = wmiDate.substr(8, 2);
      const minute = wmiDate.substr(10, 2);
      const second = wmiDate.substr(12, 2);

      return new Date(year, month, day, hour, minute, second);
    } catch (error) {
      return new Date();
    }
  }

  /**
   * Get or create WMI client for a device
   */
  async getClient(device) {
    const key = `${device.ip_address}:${device.metadata?.wmi_username || process.env.WMI_USERNAME}`;

    if (!this.clients.has(key)) {
      const config = {
        host: device.ip_address,
        username: device.metadata?.wmi_username || process.env.WMI_USERNAME,
        password: device.metadata?.wmi_password || process.env.WMI_PASSWORD,
        namespace: '\\\\root\\cimv2'
      };

      const client = new WmiClient(config);
      this.clients.set(key, client);
    }

    return this.clients.get(key);
  }

  /**
   * Test WMI connection to a device
   */
  async testConnection(device) {
    try {
      const client = await this.getClient(device);
      const result = await client.query('SELECT Caption FROM Win32_OperatingSystem');

      return {
        success: true,
        message: result && result.length > 0 ? result[0].Caption : 'Connected'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Close all WMI client connections
   */
  closeAllClients() {
    this.clients.clear();
  }
}

module.exports = WMICollector;
