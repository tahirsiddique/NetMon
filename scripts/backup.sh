#!/bin/sh
#
# Database Backup Script for Digiskills Network Monitoring System
#
# This script creates compressed backups of the PostgreSQL database
# and manages backup retention based on the configured retention period.
#

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/netmon_backup_${TIMESTAMP}.sql.gz"
BACKUP_LOG="${BACKUP_DIR}/backup.log"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Log function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_LOG}"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

log "Starting database backup..."
log "Backup file: ${BACKUP_FILE}"

# Check if required environment variables are set
if [ -z "$PGHOST" ] || [ -z "$PGDATABASE" ] || [ -z "$PGUSER" ]; then
    error_exit "Required environment variables (PGHOST, PGDATABASE, PGUSER) are not set"
fi

# Create database backup
log "Creating database dump..."
if pg_dump -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" \
    --no-owner --no-acl --clean --if-exists | gzip > "${BACKUP_FILE}"; then

    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log "Backup completed successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    error_exit "Database backup failed"
fi

# Verify backup file
if [ ! -f "${BACKUP_FILE}" ]; then
    error_exit "Backup file was not created"
fi

if [ ! -s "${BACKUP_FILE}" ]; then
    error_exit "Backup file is empty"
fi

# Clean up old backups
log "Cleaning up old backups (retention: ${BACKUP_RETENTION_DAYS} days)..."
DELETED_COUNT=0

find "${BACKUP_DIR}" -name "netmon_backup_*.sql.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} | while read -r old_backup; do
    log "Deleting old backup: ${old_backup}"
    rm -f "${old_backup}"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done

if [ $DELETED_COUNT -gt 0 ]; then
    log "Deleted ${DELETED_COUNT} old backup(s)"
else
    log "No old backups to delete"
fi

# Show backup statistics
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "netmon_backup_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

log "Backup statistics:"
log "  - Total backups: ${TOTAL_BACKUPS}"
log "  - Total size: ${TOTAL_SIZE}"
log "Backup process completed successfully"

exit 0
