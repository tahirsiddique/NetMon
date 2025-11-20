#!/bin/bash
#
# Monitoring Script for Digiskills Network Monitoring System
#
# This script checks the health of all services and can be used with cron
# for automated monitoring and alerting
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/netmon-monitor.log"
BACKEND_URL="${BACKEND_URL:-http://localhost}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@digiskills.local}"

# Service status
ALL_HEALTHY=true

# Log function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check function
check_service() {
    SERVICE_NAME=$1
    CHECK_COMMAND=$2

    if eval "$CHECK_COMMAND" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $SERVICE_NAME is healthy"
        log "INFO: $SERVICE_NAME is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $SERVICE_NAME is unhealthy"
        log "ERROR: $SERVICE_NAME is unhealthy"
        ALL_HEALTHY=false
        return 1
    fi
}

# Check Docker containers
check_containers() {
    echo ""
    echo "=== Docker Container Health ==="

    CONTAINERS=(
        "netmon-postgres"
        "netmon-redis"
        "netmon-backend-1"
        "netmon-backend-2"
        "netmon-frontend"
        "netmon-nginx"
        "netmon-alert-worker"
    )

    for CONTAINER in "${CONTAINERS[@]}"; do
        if docker ps --filter "name=$CONTAINER" --filter "status=running" --format '{{.Names}}' | grep -q "$CONTAINER"; then
            HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "unknown")
            if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "unknown" ]; then
                check_service "$CONTAINER" "echo 'running'"
            else
                check_service "$CONTAINER" "exit 1"
            fi
        else
            echo -e "${RED}✗${NC} $CONTAINER is not running"
            log "ERROR: $CONTAINER is not running"
            ALL_HEALTHY=false
        fi
    done
}

# Check HTTP endpoints
check_endpoints() {
    echo ""
    echo "=== HTTP Endpoint Health ==="

    # Backend health check
    check_service "Backend API (/health)" \
        "curl -sf ${BACKEND_URL}/health"

    # Backend readiness check
    check_service "Backend API (/ready)" \
        "curl -sf ${BACKEND_URL}/ready"

    # Frontend
    check_service "Frontend" \
        "curl -sf ${BACKEND_URL}/ -o /dev/null"

    # API endpoint
    check_service "API endpoint" \
        "curl -sf ${BACKEND_URL}/api/health"
}

# Check database
check_database() {
    echo ""
    echo "=== Database Health ==="

    # Check if postgres container is running and accepting connections
    check_service "PostgreSQL" \
        "docker exec netmon-postgres pg_isready -U monitor_user"
}

# Check Redis
check_redis() {
    echo ""
    echo "=== Redis Health ==="

    check_service "Redis" \
        "docker exec netmon-redis redis-cli ping"
}

# Check disk space
check_disk_space() {
    echo ""
    echo "=== Disk Space ==="

    THRESHOLD=80
    USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')

    if [ "$USAGE" -lt "$THRESHOLD" ]; then
        echo -e "${GREEN}✓${NC} Disk usage: ${USAGE}%"
        log "INFO: Disk usage is ${USAGE}%"
    else
        echo -e "${RED}✗${NC} Disk usage: ${USAGE}% (threshold: ${THRESHOLD}%)"
        log "WARNING: Disk usage is ${USAGE}% (threshold: ${THRESHOLD}%)"
        ALL_HEALTHY=false
    fi
}

# Check memory usage
check_memory() {
    echo ""
    echo "=== Memory Usage ==="

    MEMORY_INFO=$(free -m | grep Mem)
    TOTAL=$(echo "$MEMORY_INFO" | awk '{print $2}')
    USED=$(echo "$MEMORY_INFO" | awk '{print $3}')
    USAGE=$(echo "scale=2; $USED * 100 / $TOTAL" | bc)

    echo "Memory usage: ${USED}MB / ${TOTAL}MB (${USAGE}%)"
    log "INFO: Memory usage: ${USED}MB / ${TOTAL}MB (${USAGE}%)"
}

# Check Docker volumes
check_volumes() {
    echo ""
    echo "=== Docker Volume Usage ==="

    docker system df -v | grep "Local Volumes" -A 20 | grep netmon
}

# Send alert email (if service is down)
send_alert() {
    SUBJECT="[ALERT] Digiskills Monitor - Service Health Issue"
    BODY="Service health check failed at $(date)\n\nPlease check the logs for details."

    # Only send if mail command is available
    if command -v mail &> /dev/null; then
        echo -e "$BODY" | mail -s "$SUBJECT" "$ALERT_EMAIL"
        log "INFO: Alert email sent to $ALERT_EMAIL"
    fi
}

# Generate report
generate_report() {
    echo ""
    echo "=== Health Check Summary ==="
    echo "Timestamp: $(date)"
    echo "Overall Status: $([ "$ALL_HEALTHY" = true ] && echo -e "${GREEN}HEALTHY${NC}" || echo -e "${RED}UNHEALTHY${NC}")"
}

# Main monitoring function
main() {
    echo "====================================="
    echo "Digiskills Monitor Health Check"
    echo "====================================="

    log "INFO: Starting health check"

    check_containers
    check_endpoints
    check_database
    check_redis
    check_disk_space
    check_memory
    check_volumes
    generate_report

    # Send alert if unhealthy
    if [ "$ALL_HEALTHY" = false ]; then
        log "ERROR: System is unhealthy"
        send_alert
        exit 1
    else
        log "INFO: All systems healthy"
        exit 0
    fi
}

# Run main function
main "$@"
