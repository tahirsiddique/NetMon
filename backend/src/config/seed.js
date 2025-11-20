const { pool } = require('./database');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting database seeding...\n');

    await client.query('BEGIN');

    // 1. Create default admin user
    const adminPassword = await bcrypt.hash('Digiskills2025!', 10);
    await client.query(
      `INSERT INTO users (username, email, password_hash, role, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO NOTHING`,
      ['admin', 'admin@digiskills.local', adminPassword, 'admin', true]
    );
    console.log('✓ Created default admin user (username: admin, password: Digiskills2025!)');

    // 2. Create operator user
    const operatorPassword = await bcrypt.hash('Operator2025!', 10);
    await client.query(
      `INSERT INTO users (username, email, password_hash, role, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO NOTHING`,
      ['operator', 'operator@digiskills.local', operatorPassword, 'operator', true]
    );
    console.log('✓ Created default operator user (username: operator, password: Operator2025!)');

    // 3. Seed sample infrastructure nodes
    const sampleNodes = [
      // ESXi Hosts
      {
        name: 'ESXi-Host-01',
        type: 'esxi',
        ip: '192.168.1.10',
        status: 'unknown',
        metadata: { location: 'Server Room A', cluster: 'Production' }
      },
      {
        name: 'ESXi-Host-02',
        type: 'esxi',
        ip: '192.168.1.11',
        status: 'unknown',
        metadata: { location: 'Server Room A', cluster: 'Production' }
      },
      // Windows Servers
      {
        name: 'DC-01',
        type: 'windows_server',
        ip: '192.168.1.20',
        status: 'unknown',
        metadata: {
          role: 'Domain Controller',
          monitored_services: ['NTDS', 'DNS', 'KDC', 'Netlogon']
        }
      },
      {
        name: 'FILE-SERVER-01',
        type: 'windows_server',
        ip: '192.168.1.21',
        status: 'unknown',
        metadata: {
          role: 'File Server',
          monitored_services: ['LanmanServer', 'DFS']
        }
      },
      // Dell Servers
      {
        name: 'DELL-R740-01',
        type: 'dell_server',
        ip: '192.168.1.30',
        status: 'unknown',
        metadata: {
          model: 'PowerEdge R740',
          snmp_community: 'public',
          location: 'Server Room A'
        }
      },
      {
        name: 'DELL-R740-02',
        type: 'dell_server',
        ip: '192.168.1.31',
        status: 'unknown',
        metadata: {
          model: 'PowerEdge R740',
          snmp_community: 'public',
          location: 'Server Room A'
        }
      },
      // Network Switches
      {
        name: 'CORE-SWITCH-01',
        type: 'dell_switch',
        ip: '192.168.1.40',
        status: 'unknown',
        metadata: {
          model: 'Dell N3048',
          snmp_community: 'public',
          location: 'Server Room A'
        }
      },
      {
        name: 'ACCESS-SWITCH-01',
        type: 'dell_switch',
        ip: '192.168.1.41',
        status: 'unknown',
        metadata: {
          model: 'Dell N2048',
          snmp_community: 'public',
          location: 'Floor 1'
        }
      },
      // Firewalls
      {
        name: 'FortiGate-FW-01',
        type: 'fortigate',
        ip: '192.168.1.50',
        status: 'unknown',
        metadata: {
          model: 'FortiGate 100F',
          snmp_community: 'public',
          location: 'Server Room A'
        }
      },
      {
        name: 'pfSense-FW-01',
        type: 'pfsense',
        ip: '192.168.1.51',
        status: 'unknown',
        metadata: {
          snmp_community: 'public',
          location: 'Server Room B'
        }
      },
      // Storage
      {
        name: 'DELL-NAS-01',
        type: 'storage',
        ip: '192.168.1.60',
        status: 'unknown',
        metadata: {
          model: 'Dell PowerVault',
          snmp_community: 'public',
          capacity_tb: 20
        }
      }
    ];

    for (const node of sampleNodes) {
      await client.query(
        `INSERT INTO nodes (name, type, ip_address, status, metadata)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [node.name, node.type, node.ip, node.status, JSON.stringify(node.metadata)]
      );
    }
    console.log(`✓ Created ${sampleNodes.length} sample infrastructure nodes`);

    // 4. Create sample alert rules
    const nodeResult = await client.query(
      "SELECT id FROM nodes WHERE type = 'esxi' LIMIT 1"
    );

    if (nodeResult.rows.length > 0) {
      const nodeId = nodeResult.rows[0].id;

      await client.query(
        `INSERT INTO alert_rules (name, node_id, metric_type, condition, threshold, duration_minutes, severity, notification_channels)
         VALUES
         ($1, $2, 'cpu', 'greater_than', 90, 5, 'critical', '["email", "browser"]'),
         ($3, $2, 'memory', 'greater_than', 85, 10, 'warning', '["browser"]'),
         ($4, $2, 'disk', 'greater_than', 90, 15, 'critical', '["email", "browser"]')
         ON CONFLICT DO NOTHING`,
        [
          'ESXi Host High CPU Usage',
          nodeId,
          'ESXi Host High Memory Usage',
          'ESXi Host Low Disk Space'
        ]
      );
      console.log('✓ Created sample alert rules');
    }

    // 5. Create sample Zabbix internet links
    const sampleLinks = [
      { name: 'Primary ISP Link', status: 'up' },
      { name: 'Backup ISP Link', status: 'up' },
      { name: 'MPLS Link', status: 'up' }
    ];

    for (const link of sampleLinks) {
      await client.query(
        `INSERT INTO zabbix_internet_links (link_name, status, last_check)
         VALUES ($1, $2, NOW())
         ON CONFLICT (link_name) DO NOTHING`,
        [link.name, link.status]
      );
    }
    console.log('✓ Created sample Zabbix internet links');

    await client.query('COMMIT');
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📝 Default credentials:');
    console.log('   Admin: admin / Digiskills2025!');
    console.log('   Operator: operator / Operator2025!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
