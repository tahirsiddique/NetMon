#!/bin/bash
#
# Production Deployment Script for Digiskills Network Monitoring System
#
# This script manages the deployment of the application in production
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env.production"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

error_exit() {
    log_error "$1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed. Please install Docker first."
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error_exit "Docker Compose is not installed. Please install Docker Compose first."
    fi

    # Check if .env.production exists
    if [ ! -f "$ENV_FILE" ]; then
        log_warning ".env.production file not found"
        log_info "Creating .env.production from example..."
        cp "${PROJECT_ROOT}/.env.production.example" "$ENV_FILE"
        log_warning "Please edit .env.production with your production values before continuing"
        error_exit "Setup incomplete. Update .env.production and run this script again."
    fi

    log_success "Prerequisites check passed"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."

    cd "$PROJECT_ROOT"

    if docker-compose -f "$DOCKER_COMPOSE_FILE" build; then
        log_success "Docker images built successfully"
    else
        error_exit "Failed to build Docker images"
    fi
}

# Initialize database
init_database() {
    log_info "Initializing database..."

    # Start only postgres
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres

    # Wait for postgres to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    sleep 10

    # Run migrations
    log_info "Running database migrations..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" run --rm backend-1 node src/config/migrate.js

    log_success "Database initialized successfully"
}

# Start services
start_services() {
    log_info "Starting all services..."

    cd "$PROJECT_ROOT"

    if docker-compose -f "$DOCKER_COMPOSE_FILE" up -d; then
        log_success "All services started successfully"
    else
        error_exit "Failed to start services"
    fi

    # Show running containers
    log_info "Running containers:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
}

# Stop services
stop_services() {
    log_info "Stopping all services..."

    cd "$PROJECT_ROOT"

    if docker-compose -f "$DOCKER_COMPOSE_FILE" down; then
        log_success "All services stopped successfully"
    else
        error_exit "Failed to stop services"
    fi
}

# Restart services
restart_services() {
    log_info "Restarting all services..."
    stop_services
    start_services
}

# Show logs
show_logs() {
    SERVICE=${1:-}

    cd "$PROJECT_ROOT"

    if [ -z "$SERVICE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f --tail=100
    else
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f --tail=100 "$SERVICE"
    fi
}

# Show status
show_status() {
    log_info "Service status:"

    cd "$PROJECT_ROOT"

    docker-compose -f "$DOCKER_COMPOSE_FILE" ps

    echo ""
    log_info "Health checks:"

    # Check backend health
    if curl -s http://localhost/api/health > /dev/null 2>&1; then
        log_success "Backend API is healthy"
    else
        log_error "Backend API is not responding"
    fi

    # Check frontend
    if curl -s http://localhost/ > /dev/null 2>&1; then
        log_success "Frontend is accessible"
    else
        log_error "Frontend is not accessible"
    fi
}

# Update deployment (pull latest changes and rebuild)
update_deployment() {
    log_info "Updating deployment..."

    cd "$PROJECT_ROOT"

    # Pull latest code
    if [ -d ".git" ]; then
        log_info "Pulling latest code from git..."
        git pull
    fi

    # Rebuild images
    build_images

    # Restart services
    restart_services

    log_success "Deployment updated successfully"
}

# Run backup
run_backup() {
    log_info "Running database backup..."

    cd "$PROJECT_ROOT"

    docker-compose -f "$DOCKER_COMPOSE_FILE" --profile backup run --rm backup

    log_success "Backup completed"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 {command}

Commands:
    install         - Install and setup the application (first time)
    start           - Start all services
    stop            - Stop all services
    restart         - Restart all services
    status          - Show service status and health
    logs [service]  - Show logs (optional: specify service name)
    update          - Pull latest code and rebuild
    backup          - Run database backup
    build           - Build Docker images
    help            - Show this help message

Examples:
    $0 install
    $0 start
    $0 logs backend-1
    $0 backup

EOF
}

# Main script
main() {
    COMMAND=${1:-help}

    case "$COMMAND" in
        install)
            log_info "Starting installation..."
            check_prerequisites
            build_images
            init_database
            start_services
            log_success "Installation completed!"
            log_info "Application is running at http://localhost"
            ;;
        start)
            check_prerequisites
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            check_prerequisites
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        update)
            check_prerequisites
            update_deployment
            ;;
        backup)
            check_prerequisites
            run_backup
            ;;
        build)
            check_prerequisites
            build_images
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
