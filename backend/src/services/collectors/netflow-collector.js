const dgram = require('dgram');
const { EventEmitter } = require('events');

/**
 * NetFlow Collector Service
 * Collects NetFlow v5 and v9 data for internet usage tracking
 * Supports per-user bandwidth monitoring with username resolution
 */
class NetFlowCollector extends EventEmitter {
  constructor(port = 2055) {
    super();
    this.port = port;
    this.server = null;
    this.flowCache = new Map(); // Cache flow data for aggregation
    this.templateCache = new Map(); // NetFlow v9 templates
    this.running = false;

    // Statistics
    this.stats = {
      packetsReceived: 0,
      flowsProcessed: 0,
      errors: 0,
      lastReceived: null
    };
  }

  /**
   * Start the NetFlow collector
   */
  start() {
    if (this.running) {
      console.log('NetFlow collector already running');
      return;
    }

    this.server = dgram.createSocket('udp4');

    this.server.on('message', async (msg, rinfo) => {
      try {
        this.stats.packetsReceived++;
        this.stats.lastReceived = new Date();

        await this.processNetFlowPacket(msg, rinfo);
      } catch (error) {
        this.stats.errors++;
        console.error('NetFlow packet processing error:', error.message);
      }
    });

    this.server.on('error', (err) => {
      console.error('NetFlow collector error:', err);
      this.emit('error', err);
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`✓ NetFlow collector listening on UDP ${address.address}:${address.port}`);
      this.running = true;
      this.emit('listening', address);
    });

    this.server.bind(this.port);

    // Start periodic cache cleanup
    this.startCacheCleanup();
  }

  /**
   * Stop the NetFlow collector
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('NetFlow collector stopped');
        this.running = false;
        this.emit('stopped');
      });
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Process NetFlow packet (v5 or v9)
   */
  async processNetFlowPacket(buffer, rinfo) {
    // NetFlow header starts with version (2 bytes)
    const version = buffer.readUInt16BE(0);

    switch (version) {
      case 5:
        await this.processNetFlowV5(buffer, rinfo);
        break;
      case 9:
        await this.processNetFlowV9(buffer, rinfo);
        break;
      default:
        console.warn(`Unsupported NetFlow version: ${version}`);
    }
  }

  /**
   * Process NetFlow v5 packet
   */
  async processNetFlowV5(buffer, rinfo) {
    try {
      // NetFlow v5 header (24 bytes)
      const header = {
        version: buffer.readUInt16BE(0),
        count: buffer.readUInt16BE(2),
        sysUptime: buffer.readUInt32BE(4),
        unixSecs: buffer.readUInt32BE(8),
        unixNsecs: buffer.readUInt32BE(12),
        flowSequence: buffer.readUInt32BE(16),
        engineType: buffer.readUInt8(20),
        engineId: buffer.readUInt8(21),
        samplingInterval: buffer.readUInt16BE(22)
      };

      // Each flow record is 48 bytes
      const flowRecordSize = 48;
      const flows = [];

      for (let i = 0; i < header.count; i++) {
        const offset = 24 + (i * flowRecordSize);

        if (offset + flowRecordSize > buffer.length) {
          break;
        }

        const flow = this.parseNetFlowV5Record(buffer, offset);
        flows.push(flow);
      }

      // Process flows
      for (const flow of flows) {
        await this.processFlow(flow);
      }

      this.stats.flowsProcessed += flows.length;

    } catch (error) {
      console.error('NetFlow v5 processing error:', error);
      throw error;
    }
  }

  /**
   * Parse NetFlow v5 record
   */
  parseNetFlowV5Record(buffer, offset) {
    return {
      srcaddr: this.parseIPv4(buffer, offset),
      dstaddr: this.parseIPv4(buffer, offset + 4),
      nexthop: this.parseIPv4(buffer, offset + 8),
      input: buffer.readUInt16BE(offset + 12),
      output: buffer.readUInt16BE(offset + 14),
      dPkts: buffer.readUInt32BE(offset + 16),
      dOctets: buffer.readUInt32BE(offset + 20),
      first: buffer.readUInt32BE(offset + 24),
      last: buffer.readUInt32BE(offset + 28),
      srcport: buffer.readUInt16BE(offset + 32),
      dstport: buffer.readUInt16BE(offset + 34),
      tcp_flags: buffer.readUInt8(offset + 37),
      prot: buffer.readUInt8(offset + 38),
      tos: buffer.readUInt8(offset + 39),
      src_as: buffer.readUInt16BE(offset + 40),
      dst_as: buffer.readUInt16BE(offset + 42),
      src_mask: buffer.readUInt8(offset + 44),
      dst_mask: buffer.readUInt8(offset + 45)
    };
  }

  /**
   * Process NetFlow v9 packet (template-based)
   */
  async processNetFlowV9(buffer, rinfo) {
    try {
      // NetFlow v9 header (20 bytes)
      const header = {
        version: buffer.readUInt16BE(0),
        count: buffer.readUInt16BE(2),
        sysUptime: buffer.readUInt32BE(4),
        unixSecs: buffer.readUInt32BE(8),
        packageSequence: buffer.readUInt32BE(12),
        sourceId: buffer.readUInt32BE(16)
      };

      let offset = 20;
      const flows = [];

      // Process flowsets
      while (offset < buffer.length) {
        const flowsetId = buffer.readUInt16BE(offset);
        const flowsetLength = buffer.readUInt16BE(offset + 2);

        if (flowsetLength === 0 || offset + flowsetLength > buffer.length) {
          break;
        }

        if (flowsetId === 0) {
          // Template FlowSet
          this.parseNetFlowV9Template(buffer, offset + 4, flowsetLength - 4, header.sourceId);
        } else if (flowsetId === 1) {
          // Options Template FlowSet (skip for now)
        } else if (flowsetId >= 256) {
          // Data FlowSet
          const template = this.templateCache.get(`${header.sourceId}:${flowsetId}`);
          if (template) {
            const dataFlows = this.parseNetFlowV9Data(buffer, offset + 4, flowsetLength - 4, template);
            flows.push(...dataFlows);
          }
        }

        offset += flowsetLength;
      }

      // Process flows
      for (const flow of flows) {
        await this.processFlow(flow);
      }

      this.stats.flowsProcessed += flows.length;

    } catch (error) {
      console.error('NetFlow v9 processing error:', error);
      throw error;
    }
  }

  /**
   * Parse NetFlow v9 template
   */
  parseNetFlowV9Template(buffer, offset, length, sourceId) {
    let pos = offset;

    while (pos < offset + length) {
      const templateId = buffer.readUInt16BE(pos);
      const fieldCount = buffer.readUInt16BE(pos + 2);
      pos += 4;

      const fields = [];
      for (let i = 0; i < fieldCount; i++) {
        const fieldType = buffer.readUInt16BE(pos);
        const fieldLength = buffer.readUInt16BE(pos + 2);
        fields.push({ type: fieldType, length: fieldLength });
        pos += 4;
      }

      this.templateCache.set(`${sourceId}:${templateId}`, {
        id: templateId,
        fields: fields
      });
    }
  }

  /**
   * Parse NetFlow v9 data using template
   */
  parseNetFlowV9Data(buffer, offset, length, template) {
    const flows = [];
    let pos = offset;

    while (pos < offset + length) {
      const flow = {};

      for (const field of template.fields) {
        if (pos + field.length > buffer.length) {
          break;
        }

        const value = this.parseNetFlowV9Field(buffer, pos, field);
        flow[this.getFieldName(field.type)] = value;
        pos += field.length;
      }

      if (Object.keys(flow).length > 0) {
        flows.push(flow);
      }
    }

    return flows;
  }

  /**
   * Parse NetFlow v9 field value
   */
  parseNetFlowV9Field(buffer, offset, field) {
    switch (field.length) {
      case 1:
        return buffer.readUInt8(offset);
      case 2:
        return buffer.readUInt16BE(offset);
      case 4:
        // Check if it's an IP address (field types 8, 12)
        if (field.type === 8 || field.type === 12) {
          return this.parseIPv4(buffer, offset);
        }
        return buffer.readUInt32BE(offset);
      case 8:
        return buffer.readBigUInt64BE(offset);
      default:
        return buffer.toString('hex', offset, offset + field.length);
    }
  }

  /**
   * Get field name from NetFlow v9 field type
   */
  getFieldName(type) {
    const fieldNames = {
      1: 'dOctets',
      2: 'dPkts',
      4: 'prot',
      7: 'srcport',
      8: 'srcaddr',
      11: 'dstport',
      12: 'dstaddr',
      14: 'output',
      21: 'last',
      22: 'first'
    };

    return fieldNames[type] || `field_${type}`;
  }

  /**
   * Parse IPv4 address from buffer
   */
  parseIPv4(buffer, offset) {
    return `${buffer.readUInt8(offset)}.${buffer.readUInt8(offset + 1)}.` +
           `${buffer.readUInt8(offset + 2)}.${buffer.readUInt8(offset + 3)}`;
  }

  /**
   * Process individual flow record
   */
  async processFlow(flow) {
    try {
      // Determine if this is outbound traffic (from internal network)
      const isOutbound = this.isInternalIP(flow.srcaddr);
      const sourceIP = isOutbound ? flow.srcaddr : flow.dstaddr;
      const destinationIP = isOutbound ? flow.dstaddr : flow.srcaddr;
      const bytes = flow.dOctets || 0;

      // Skip if no data
      if (bytes === 0) {
        return;
      }

      // Aggregate flow data
      const key = `${sourceIP}:${this.getFlowKey(flow)}`;

      if (this.flowCache.has(key)) {
        const cached = this.flowCache.get(key);
        cached.bytes += bytes;
        cached.packets += flow.dPkts || 0;
        cached.lastSeen = Date.now();
      } else {
        this.flowCache.set(key, {
          sourceIP: sourceIP,
          destinationIP: destinationIP,
          protocol: this.getProtocolName(flow.prot),
          srcPort: flow.srcport,
          dstPort: flow.dstport,
          bytes: bytes,
          packets: flow.dPkts || 0,
          firstSeen: Date.now(),
          lastSeen: Date.now()
        });
      }

      // Emit flow event for processing
      this.emit('flow', {
        sourceIP,
        destinationIP,
        bytes,
        protocol: this.getProtocolName(flow.prot)
      });

    } catch (error) {
      console.error('Flow processing error:', error);
    }
  }

  /**
   * Get flow key for aggregation
   */
  getFlowKey(flow) {
    return `${flow.prot}:${flow.srcport || 0}:${flow.dstport || 0}`;
  }

  /**
   * Check if IP is internal (private network)
   */
  isInternalIP(ip) {
    const parts = ip.split('.').map(Number);

    // 10.0.0.0/8
    if (parts[0] === 10) return true;

    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    return false;
  }

  /**
   * Get protocol name from number
   */
  getProtocolName(protNumber) {
    const protocols = {
      1: 'ICMP',
      6: 'TCP',
      17: 'UDP',
      41: 'IPv6',
      47: 'GRE',
      50: 'ESP',
      51: 'AH',
      89: 'OSPF'
    };

    return protocols[protNumber] || `Protocol-${protNumber}`;
  }

  /**
   * Get aggregated flows from cache
   */
  getAggregatedFlows() {
    const flows = Array.from(this.flowCache.values());
    return flows;
  }

  /**
   * Clear flow cache
   */
  clearCache() {
    const count = this.flowCache.size;
    this.flowCache.clear();
    return count;
  }

  /**
   * Start periodic cache cleanup
   */
  startCacheCleanup() {
    // Clean up old flows every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes

      for (const [key, flow] of this.flowCache.entries()) {
        if (now - flow.lastSeen > maxAge) {
          this.flowCache.delete(key);
        }
      }
    }, 60000); // Run every minute
  }

  /**
   * Get collector statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.flowCache.size,
      templatesLoaded: this.templateCache.size,
      running: this.running
    };
  }
}

module.exports = NetFlowCollector;
