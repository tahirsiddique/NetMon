# Digiskills Network Monitoring System

A comprehensive, production-ready web-based network infrastructure monitoring system for the Digiskills IT Department. This "Single Pane of Glass" dashboard consolidates monitoring data from heterogeneous IT infrastructure including VMware ESXi hosts, Windows Servers, Dell hardware, network devices, and client workstations.

## 🎯 Key Features

- **Real-time Monitoring**: Live dashboard updates with WebSocket support
- **Multi-Device Support**: Monitor ESXi hosts, Windows servers, Dell hardware, switches, firewalls
- **Per-User Internet Tracking**: NetFlow/sFlow integration for bandwidth usage analytics
- **Intelligent Alerting**: Configurable alerts with email and browser notifications
- **Secure Authentication**: JWT-based auth with Active Directory integration
- **Role-Based Access**: Admin and Operator roles with granular permissions
- **Scalable Architecture**: Built to handle 500+ client nodes and 50+ infrastructure devices

## 🏗️ Technology Stack

### Backend
- **Framework**: Node.js with Express.js
- **Database**: PostgreSQL with TimescaleDB extension for time-series data
- **Cache**: Redis for high-performance caching
- **Task Queue**: Bull Queue for background monitoring jobs
- **WebSocket**: Socket.io for real-time updates
- **Monitoring**: SNMP, WMI, NetFlow/sFlow collectors

### Frontend
- **Framework**: React.js with Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Chart.js and Recharts
- **Icons**: Lucide React

## 📋 Prerequisites

Before installation, ensure you have:

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL 14+ (or use Docker)
- Redis 7+ (or use Docker)
- Network access to monitored devices

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd NetMon
```

### 2. Start Database Services

```bash
# Start PostgreSQL with TimescaleDB and Redis using Docker
docker-compose up -d

# Wait for services to be ready (about 10 seconds)
docker-compose ps
```

### 3. Configure Environment

```bash
# The .env file is already configured for local development
# For production, edit .env with your configuration
nano .env
```

### 4. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 5. Initialize Database

```bash
cd backend

# Run migrations to create tables
npm run migrate

# Seed initial data (admin user, sample nodes)
npm run seed
```

### 6. Start the Application

```bash
# Terminal 1: Start backend server
cd backend
npm run dev

# Terminal 2: Start frontend development server
cd frontend
npm run dev
```

### 7. Access the Dashboard

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

### Default Credentials

```
Admin Account:
Username: admin
Password: Digiskills2025!

Operator Account:
Username: operator
Password: Operator2025!
```

## 📁 Project Structure

```
NetMon/
├── backend/                    # Backend Node.js application
│   ├── src/
│   │   ├── config/            # Database, Redis, Socket.io config
│   │   │   ├── database.js
│   │   │   ├── redis.js
│   │   │   ├── socket.js
│   │   │   ├── migrate.js
│   │   │   └── seed.js
│   │   ├── controllers/       # Route controllers
│   │   │   ├── auth.controller.js
│   │   │   ├── nodes.controller.js
│   │   │   └── dashboard.controller.js
│   │   ├── middleware/        # Authentication & validation
│   │   │   └── auth.js
│   │   ├── services/          # Business logic
│   │   │   ├── collectors/    # SNMP, WMI, NetFlow collectors
│   │   │   └── integrations/  # Zabbix API integration
│   │   ├── workers/           # Background job processors
│   │   └── server.js          # Main application entry
│   └── package.json
│
├── frontend/                   # React frontend application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── dashboard/
│   │   │   ├── charts/
│   │   │   └── common/
│   │   ├── pages/             # Page components
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Nodes.jsx
│   │   │   ├── Alerts.jsx
│   │   │   ├── InternetUsage.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/          # API clients
│   │   │   ├── api.js
│   │   │   └── socket.js
│   │   ├── store/             # State management
│   │   │   └── authStore.js
│   │   └── App.jsx
│   └── package.json
│
├── docker-compose.yml          # Docker services configuration
├── .env.example               # Environment variables template
└── README.md                  # This file
```

## 🔧 Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# Database
DATABASE_URL=postgresql://monitor_user:SecurePassword123!@localhost:5432/digiskills_monitor
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=YourSuperSecretJWTKeyChangeInProduction
AD_LDAP_URL=ldap://dc.digiskills.local:389
AD_DOMAIN=digiskills.local

# Application
APP_URL=http://localhost:3000
NODE_ENV=development
PORT=3000
```

## 🗺️ Development Roadmap

### ✅ Phase 1: Foundation (Completed)
- [x] Project structure and initialization
- [x] PostgreSQL with TimescaleDB setup
- [x] Redis configuration
- [x] Express.js backend with authentication
- [x] React frontend with Tailwind CSS
- [x] WebSocket integration

### 🚧 Phase 2: Core Monitoring Engine (Next)
- [ ] SNMP collector service for Dell/network devices
- [ ] WMI collector service for Windows servers
- [ ] Bull Queue for background monitoring workers
- [ ] Real-time metrics collection and storage

### 📅 Phase 3: Internet Usage Tracking (Planned)
- [ ] NetFlow/sFlow collector implementation
- [ ] Per-user bandwidth tracking

### 📅 Phase 4-8: Additional Features (Planned)
- [ ] Zabbix Integration
- [ ] Dashboard Enhancements
- [ ] Alerting System
- [ ] Advanced Security
- [ ] Production Deployment

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec -it digiskills_postgres psql -U monitor_user -d digiskills_monitor
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
docker exec -it digiskills_redis redis-cli ping
```

## 📄 License

Proprietary - Digiskills IT Department © 2025

---

**Last Updated**: November 20, 2025
**Version**: 1.0.0 (Phase 1 Complete)