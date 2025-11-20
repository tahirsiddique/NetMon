const { pool } = require('./database');
require('dotenv').config();

const migrations = [
  // Migration 1: Create base tables
  {
    name: 'create_base_tables',
    sql: `
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Infrastructure Nodes
      CREATE TABLE IF NOT EXISTS nodes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        ip_address INET NOT NULL,
        status VARCHAR(20) DEFAULT 'unknown',
        last_seen TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_nodes_type ON nodes(type);
      CREATE INDEX idx_nodes_status ON nodes(status);
      CREATE INDEX idx_nodes_ip ON nodes(ip_address);
    `
  },

  // Migration 2: Create metrics table with TimescaleDB
  {
    name: 'create_metrics_hypertable',
    sql: `
      -- Monitoring Metrics (Time-Series)
      CREATE TABLE IF NOT EXISTS metrics (
        time TIMESTAMPTZ NOT NULL,
        node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        metric_type VARCHAR(50) NOT NULL,
        value NUMERIC NOT NULL,
        unit VARCHAR(20),
        CONSTRAINT metrics_pkey PRIMARY KEY (time, node_id, metric_type)
      );

      -- Create hypertable for time-series data
      SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE);

      CREATE INDEX idx_metrics_node_time ON metrics (node_id, time DESC);
      CREATE INDEX idx_metrics_type_time ON metrics (metric_type, time DESC);
    `
  },

  // Migration 3: Create service and hardware monitoring tables
  {
    name: 'create_monitoring_tables',
    sql: `
      -- Windows Services Monitoring
      CREATE TABLE IF NOT EXISTS service_status (
        id SERIAL PRIMARY KEY,
        node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
        service_name VARCHAR(100) NOT NULL,
        status VARCHAR(20),
        checked_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_service_node ON service_status(node_id);

      -- Hardware Health Status
      CREATE TABLE IF NOT EXISTS hardware_health (
        id SERIAL PRIMARY KEY,
        node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
        component_type VARCHAR(50),
        component_name VARCHAR(100),
        status VARCHAR(20),
        details JSONB,
        checked_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_hardware_node ON hardware_health(node_id);
    `
  },

  // Migration 4: Create internet usage tracking table
  {
    name: 'create_internet_usage_table',
    sql: `
      -- Internet Usage Tracking
      CREATE TABLE IF NOT EXISTS internet_usage (
        time TIMESTAMPTZ NOT NULL,
        username VARCHAR(100),
        hostname VARCHAR(255),
        ip_address INET,
        bytes_sent BIGINT,
        bytes_received BIGINT,
        protocol VARCHAR(20),
        destination VARCHAR(255),
        CONSTRAINT usage_pkey PRIMARY KEY (time, ip_address)
      );

      -- Create hypertable for time-series data
      SELECT create_hypertable('internet_usage', 'time', if_not_exists => TRUE);

      CREATE INDEX idx_usage_username_time ON internet_usage (username, time DESC);
      CREATE INDEX idx_usage_ip_time ON internet_usage (ip_address, time DESC);
    `
  },

  // Migration 5: Create alert tables
  {
    name: 'create_alert_tables',
    sql: `
      -- Alert Configurations
      CREATE TABLE IF NOT EXISTS alert_rules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
        metric_type VARCHAR(50),
        condition VARCHAR(20),
        threshold NUMERIC,
        duration_minutes INTEGER DEFAULT 5,
        severity VARCHAR(20),
        enabled BOOLEAN DEFAULT true,
        notification_channels JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

      -- Active Alerts
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER REFERENCES alert_rules(id) ON DELETE CASCADE,
        node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
        message TEXT,
        severity VARCHAR(20),
        triggered_at TIMESTAMP DEFAULT NOW(),
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_by VARCHAR(100),
        resolved_at TIMESTAMP
      );

      CREATE INDEX idx_alerts_unresolved ON alerts (node_id) WHERE resolved_at IS NULL;
      CREATE INDEX idx_alerts_severity ON alerts(severity);
    `
  },

  // Migration 6: Create users table
  {
    name: 'create_users_table',
    sql: `
      -- Users and Authentication
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255),
        password_hash VARCHAR(255),
        role VARCHAR(20) DEFAULT 'operator',
        active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_users_username ON users(username);
    `
  },

  // Migration 7: Create Zabbix integration table
  {
    name: 'create_zabbix_integration_table',
    sql: `
      -- Zabbix Integration Cache
      CREATE TABLE IF NOT EXISTS zabbix_internet_links (
        id SERIAL PRIMARY KEY,
        link_name VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(20),
        last_check TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_zabbix_links_status ON zabbix_internet_links(status);
    `
  },

  // Migration 8: Update alert tables for Phase 6
  {
    name: 'update_alert_tables_phase6',
    sql: `
      -- Update alert_rules table structure
      ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS condition_operator VARCHAR(10);
      ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS threshold_value NUMERIC;
      ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;
      ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

      -- Drop old columns if they exist
      ALTER TABLE alert_rules DROP COLUMN IF EXISTS condition;
      ALTER TABLE alert_rules DROP COLUMN IF EXISTS threshold;
      ALTER TABLE alert_rules DROP COLUMN IF EXISTS duration_minutes;
      ALTER TABLE alert_rules DROP COLUMN IF EXISTS notification_channels;

      -- Update alerts table structure
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS current_value NUMERIC;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS threshold_value NUMERIC;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledgement_comment TEXT;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS auto_resolved BOOLEAN DEFAULT false;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolution_comment TEXT;
      ALTER TABLE alerts ALTER COLUMN acknowledged_by TYPE INTEGER USING acknowledged_by::integer;

      -- Create alert_notifications table
      CREATE TABLE IF NOT EXISTS alert_notifications (
        id SERIAL PRIMARY KEY,
        alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
        notification_type VARCHAR(20) NOT NULL,
        recipient TEXT NOT NULL,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert ON alert_notifications(alert_id);
      CREATE INDEX IF NOT EXISTS idx_alert_notifications_status ON alert_notifications(status);

      -- Update users table for email notifications
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_severity VARCHAR(20) DEFAULT 'all';
    `
  },

  // Migration 9: Create security and audit tables for Phase 7
  {
    name: 'create_security_audit_tables_phase7',
    sql: `
      -- Audit Logs Table
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        user_id INTEGER,
        username VARCHAR(100),
        ip_address INET,
        user_agent TEXT,
        resource VARCHAR(100),
        resource_id VARCHAR(100),
        action VARCHAR(50),
        status VARCHAR(20),
        severity VARCHAR(20),
        details TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);

      -- User Sessions Table
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_activity TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
    `
  },

  // Migration 10: Create migration tracking table
  {
    name: 'create_migrations_table',
    sql: `
      -- Track applied migrations
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `
  }
];

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting database migrations...\n');

    // Ensure TimescaleDB extension is enabled
    await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;');
    console.log('✓ TimescaleDB extension enabled');

    for (const migration of migrations) {
      // Check if migration already applied
      const checkResult = await client.query(
        'SELECT name FROM migrations WHERE name = $1',
        [migration.name]
      ).catch(() => ({ rows: [] }));

      if (checkResult.rows.length > 0) {
        console.log(`⊘ Migration '${migration.name}' already applied`);
        continue;
      }

      console.log(`→ Running migration: ${migration.name}`);

      await client.query('BEGIN');

      try {
        await client.query(migration.sql);

        // Record migration
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );

        await client.query('COMMIT');
        console.log(`✓ Migration '${migration.name}' completed successfully\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`✗ Migration '${migration.name}' failed:`, error.message);
        throw error;
      }
    }

    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
