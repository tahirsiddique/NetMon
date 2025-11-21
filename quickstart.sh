#!/bin/bash

# Digiskills Network Monitor - Quick Start Script
# This script automates the initial setup process

set -e  # Exit on error

echo "================================"
echo "Digiskills Network Monitor"
echo "Quick Start Setup"
echo "================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker $(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠ docker-compose command not found, trying docker compose...${NC}"
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}✗ Docker Compose is not installed.${NC}"
        exit 1
    fi
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi
echo -e "${GREEN}✓ Docker Compose${NC}"

echo ""

# Step 1: Start Docker services
echo -e "${BLUE}Step 1: Starting PostgreSQL and Redis...${NC}"
$DOCKER_COMPOSE up -d

echo "Waiting for services to be ready..."
sleep 10

# Check if containers are running
if docker ps | grep -q "digiskills_postgres"; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${RED}✗ PostgreSQL failed to start${NC}"
    exit 1
fi

if docker ps | grep -q "digiskills_redis"; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis failed to start${NC}"
    exit 1
fi

echo ""

# Step 2: Install backend dependencies
echo -e "${BLUE}Step 2: Installing backend dependencies...${NC}"
cd backend
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
echo ""

# Step 3: Run migrations
echo -e "${BLUE}Step 3: Running database migrations...${NC}"
npm run migrate
echo -e "${GREEN}✓ Database migrations completed${NC}"
echo ""

# Step 4: Seed database
echo -e "${BLUE}Step 4: Seeding database with initial data...${NC}"
npm run seed
echo -e "${GREEN}✓ Database seeded successfully${NC}"
echo ""

# Step 5: Install frontend dependencies
echo -e "${BLUE}Step 5: Installing frontend dependencies...${NC}"
cd ../frontend
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
echo ""

cd ..

# Success message
echo "================================"
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo "================================"
echo ""
echo "To start the application:"
echo ""
echo "  Terminal 1 - Backend:"
echo "  $ cd backend"
echo "  $ npm run dev"
echo ""
echo "  Terminal 2 - Frontend:"
echo "  $ cd frontend"
echo "  $ npm run dev"
echo ""
echo "Access the dashboard at: http://localhost:5173"
echo ""
echo "Default credentials:"
echo "  Admin:    admin / Digiskills2025!"
echo "  Operator: operator / Operator2025!"
echo ""
echo "Health check: http://localhost:3000/health"
echo ""
echo "================================"
