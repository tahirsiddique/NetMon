.PHONY: help install start stop restart status logs logs-backend logs-frontend logs-nginx backup restore health dev dev-build build clean clean-all

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

# Variables
DOCKER_COMPOSE := docker-compose
DOCKER_COMPOSE_DEV := docker-compose -f docker-compose.dev.yml
PROJECT_NAME := netmon

##@ Help

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\n$(BLUE)Usage:$(NC)\n  make $(GREEN)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Production Deployment

install: ## First-time installation (build, init DB, start services)
	@echo "$(BLUE)Installing Digiskills Network Monitoring System...$(NC)"
	@./scripts/deploy.sh install

start: ## Start all production services
	@echo "$(BLUE)Starting services...$(NC)"
	@$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)Services started successfully!$(NC)"
	@make status

stop: ## Stop all production services
	@echo "$(BLUE)Stopping services...$(NC)"
	@$(DOCKER_COMPOSE) down
	@echo "$(GREEN)Services stopped successfully!$(NC)"

restart: ## Restart all production services
	@echo "$(BLUE)Restarting services...$(NC)"
	@$(DOCKER_COMPOSE) restart
	@echo "$(GREEN)Services restarted successfully!$(NC)"

status: ## Show service status and health
	@echo "$(BLUE)Service Status:$(NC)"
	@$(DOCKER_COMPOSE) ps
	@echo ""
	@echo "$(BLUE)Health Check:$(NC)"
	@./scripts/monitor.sh 2>/dev/null || echo "$(YELLOW)Run './scripts/monitor.sh' for detailed health check$(NC)"

##@ Development

dev: ## Start development environment
	@echo "$(BLUE)Starting development environment...$(NC)"
	@$(DOCKER_COMPOSE_DEV) up -d postgres redis
	@echo "$(YELLOW)Database services started. Run 'npm run dev' in backend and frontend directories.$(NC)"

dev-build: ## Build development images
	@echo "$(BLUE)Building development images...$(NC)"
	@$(DOCKER_COMPOSE_DEV) build

dev-stop: ## Stop development environment
	@echo "$(BLUE)Stopping development environment...$(NC)"
	@$(DOCKER_COMPOSE_DEV) down

##@ Build

build: ## Build production Docker images
	@echo "$(BLUE)Building production images...$(NC)"
	@$(DOCKER_COMPOSE) build
	@echo "$(GREEN)Images built successfully!$(NC)"

rebuild: ## Rebuild and restart all services
	@echo "$(BLUE)Rebuilding all services...$(NC)"
	@$(DOCKER_COMPOSE) build
	@$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)Services rebuilt and restarted!$(NC)"

##@ Logs

logs: ## View logs from all services
	@$(DOCKER_COMPOSE) logs -f --tail=100

logs-backend: ## View backend logs
	@$(DOCKER_COMPOSE) logs -f --tail=100 backend-1 backend-2

logs-frontend: ## View frontend logs
	@$(DOCKER_COMPOSE) logs -f --tail=100 frontend

logs-nginx: ## View nginx logs
	@$(DOCKER_COMPOSE) logs -f --tail=100 nginx

logs-postgres: ## View PostgreSQL logs
	@$(DOCKER_COMPOSE) logs -f --tail=100 postgres

logs-redis: ## View Redis logs
	@$(DOCKER_COMPOSE) logs -f --tail=100 redis

logs-worker: ## View alert worker logs
	@$(DOCKER_COMPOSE) logs -f --tail=100 alert-worker

##@ Maintenance

backup: ## Run database backup
	@echo "$(BLUE)Running database backup...$(NC)"
	@$(DOCKER_COMPOSE) --profile backup run --rm backup
	@echo "$(GREEN)Backup completed!$(NC)"

restore: ## Restore database from backup (interactive)
	@echo "$(BLUE)Available backups:$(NC)"
	@ls -lh backups/netmon_backup_*.sql.gz 2>/dev/null || echo "$(YELLOW)No backups found$(NC)"
	@echo ""
	@echo "$(YELLOW)To restore, run: ./scripts/restore.sh <backup-file>$(NC)"

health: ## Run comprehensive health check
	@echo "$(BLUE)Running health checks...$(NC)"
	@./scripts/monitor.sh

update: ## Pull latest code and update deployment
	@echo "$(BLUE)Updating deployment...$(NC)"
	@./scripts/deploy.sh update

migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	@$(DOCKER_COMPOSE) run --rm backend-1 node src/config/migrate.js
	@echo "$(GREEN)Migrations completed!$(NC)"

##@ Database

db-shell: ## Open PostgreSQL shell
	@$(DOCKER_COMPOSE) exec postgres psql -U monitor_user -d digiskills_monitor

db-backup-manual: ## Create manual database backup
	@echo "$(BLUE)Creating manual backup...$(NC)"
	@$(DOCKER_COMPOSE) exec postgres pg_dump -U monitor_user digiskills_monitor | gzip > backups/manual_backup_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "$(GREEN)Manual backup created!$(NC)"

redis-cli: ## Open Redis CLI
	@$(DOCKER_COMPOSE) exec redis redis-cli

##@ Cleanup

clean: ## Remove all containers (preserves volumes)
	@echo "$(BLUE)Removing containers...$(NC)"
	@$(DOCKER_COMPOSE) down
	@echo "$(GREEN)Containers removed!$(NC)"

clean-all: ## Remove all containers and volumes (DESTRUCTIVE!)
	@echo "$(YELLOW)WARNING: This will remove all data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "$(BLUE)Removing containers and volumes...$(NC)"; \
		$(DOCKER_COMPOSE) down -v; \
		echo "$(GREEN)Cleanup completed!$(NC)"; \
	else \
		echo "$(YELLOW)Cleanup cancelled.$(NC)"; \
	fi

clean-logs: ## Remove old log files
	@echo "$(BLUE)Cleaning old logs...$(NC)"
	@find backend/logs -name "*.log" -mtime +30 -delete 2>/dev/null || true
	@echo "$(GREEN)Log cleanup completed!$(NC)"

##@ Scaling

scale-backend: ## Scale backend instances (usage: make scale-backend N=3)
	@echo "$(BLUE)Scaling backend to $(N) instances...$(NC)"
	@$(DOCKER_COMPOSE) up -d --scale backend-1=$(N)
	@echo "$(GREEN)Backend scaled to $(N) instances!$(NC)"

##@ Testing

test-backend: ## Run backend tests
	@echo "$(BLUE)Running backend tests...$(NC)"
	@cd backend && npm test

test-frontend: ## Run frontend tests
	@echo "$(BLUE)Running frontend tests...$(NC)"
	@cd frontend && npm test

test-api: ## Test API health endpoints
	@echo "$(BLUE)Testing API endpoints...$(NC)"
	@curl -f http://localhost/health || echo "$(YELLOW)Backend health check failed$(NC)"
	@echo ""
	@curl -f http://localhost/ready || echo "$(YELLOW)Backend readiness check failed$(NC)"
	@echo ""
	@curl -f http://localhost/ || echo "$(YELLOW)Frontend check failed$(NC)"

##@ Monitoring

ps: ## Show running containers
	@$(DOCKER_COMPOSE) ps

top: ## Show container resource usage
	@docker stats --no-stream

inspect: ## Inspect service configuration
	@$(DOCKER_COMPOSE) config

##@ Quick Actions

quick-start: install ## Alias for install

quick-restart: restart ## Alias for restart

quick-logs: logs ## Alias for logs

quick-backup: backup ## Alias for backup

##@ Information

version: ## Show version information
	@echo "$(BLUE)Digiskills Network Monitoring System$(NC)"
	@echo "Version: 2.0.0"
	@echo "Status: Production Ready"
	@echo ""
	@echo "$(BLUE)Components:$(NC)"
	@docker --version
	@docker-compose --version
	@echo ""
	@echo "$(BLUE)Services:$(NC)"
	@$(DOCKER_COMPOSE) ps --services

info: ## Show system information
	@echo "$(BLUE)System Information:$(NC)"
	@echo "Project: $(PROJECT_NAME)"
	@echo "Docker Compose File: docker-compose.yml"
	@echo ""
	@echo "$(BLUE)Running Services:$(NC)"
	@$(DOCKER_COMPOSE) ps
	@echo ""
	@echo "$(BLUE)Volumes:$(NC)"
	@docker volume ls | grep $(PROJECT_NAME) || echo "No volumes found"
	@echo ""
	@echo "$(BLUE)Networks:$(NC)"
	@docker network ls | grep $(PROJECT_NAME) || echo "No networks found"
