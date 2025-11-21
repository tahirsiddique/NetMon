#!/bin/bash

# Digiskills Network Monitor - Start Monitoring System
# This script starts both the API server and the monitoring worker

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "Digiskills Network Monitor"
echo "Starting Monitoring System"
echo "================================"
echo ""

# Check if Docker services are running
echo -e "${BLUE}Checking Docker services...${NC}"
if ! docker ps | grep -q "digiskills_postgres"; then
    echo -e "${YELLOW}⚠ PostgreSQL not running. Starting Docker services...${NC}"
    docker-compose up -d
    sleep 5
fi

if ! docker ps | grep -q "digiskills_redis"; then
    echo -e "${YELLOW}⚠ Redis not running. Starting Docker services...${NC}"
    docker-compose up -d
    sleep 5
fi

echo -e "${GREEN}✓ Docker services are running${NC}"
echo ""

# Check if node_modules exist
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}⚠ Backend dependencies not installed. Installing...${NC}"
    cd backend && npm install && cd ..
fi

echo -e "${BLUE}Starting monitoring system...${NC}"
echo ""
echo "This will start two processes:"
echo "  1. API Server (Port 3000)"
echo "  2. Monitoring Worker (Background metrics collection)"
echo ""
echo "Press Ctrl+C to stop all processes"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping monitoring system...${NC}"
    kill $API_PID $WORKER_PID 2>/dev/null
    echo -e "${GREEN}✓ Monitoring system stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start API server
cd backend
echo -e "${BLUE}Starting API Server...${NC}"
npm run dev &
API_PID=$!
sleep 3

# Start monitoring worker
echo -e "${BLUE}Starting Monitoring Worker...${NC}"
npm run worker:dev &
WORKER_PID=$!
sleep 2

echo ""
echo "================================"
echo -e "${GREEN}✅ Monitoring system started!${NC}"
echo "================================"
echo ""
echo "  API Server: http://localhost:3000"
echo "  Frontend: http://localhost:5173 (start separately)"
echo ""
echo "  Process IDs:"
echo "    API: $API_PID"
echo "    Worker: $WORKER_PID"
echo ""
echo "  Logs are shown below..."
echo "  Press Ctrl+C to stop"
echo ""
echo "================================"
echo ""

# Wait for processes
wait $API_PID $WORKER_PID
