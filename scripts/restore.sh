#!/bin/sh
#
# Database Restore Script for Digiskills Network Monitoring System
#
# This script restores the PostgreSQL database from a backup file.
# Usage: ./restore.sh [backup_file]
#

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RESTORE_LOG="${BACKUP_DIR}/restore.log"

# Log function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${RESTORE_LOG}"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check if backup file is provided
if [ -z "$1" ]; then
    log "Usage: $0 <backup_file>"
    log ""
    log "Available backups:"
    find "${BACKUP_DIR}" -name "netmon_backup_*.sql.gz" -type f -exec ls -lh {} \; | awk '{print "  ", $9, "("$5")"}'
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    error_exit "Backup file not found: ${BACKUP_FILE}"
fi

log "Starting database restore..."
log "Backup file: ${BACKUP_FILE}"

# Check if required environment variables are set
if [ -z "$PGHOST" ] || [ -z "$PGDATABASE" ] || [ -z "$PGUSER" ]; then
    error_exit "Required environment variables (PGHOST, PGDATABASE, PGUSER) are not set"
fi

# Warning prompt
log "WARNING: This will overwrite the current database!"
log "Database: ${PGDATABASE}@${PGHOST}"
log "Press Ctrl+C within 10 seconds to cancel..."
sleep 10

# Create a backup of current database before restore
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PRE_RESTORE_BACKUP="${BACKUP_DIR}/pre_restore_backup_${TIMESTAMP}.sql.gz"

log "Creating pre-restore backup: ${PRE_RESTORE_BACKUP}"
if pg_dump -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" \
    --no-owner --no-acl --clean --if-exists | gzip > "${PRE_RESTORE_BACKUP}"; then
    log "Pre-restore backup created successfully"
else
    log "WARNING: Pre-restore backup failed, continuing with restore..."
fi

# Restore database
log "Restoring database from backup..."
if gunzip < "${BACKUP_FILE}" | psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" -q; then
    log "Database restored successfully"
else
    error_exit "Database restore failed"
fi

# Verify restore
log "Verifying database connection..."
if psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1; then
    log "Database verification successful"
else
    error_exit "Database verification failed"
fi

log "Restore process completed successfully"
log "Pre-restore backup saved at: ${PRE_RESTORE_BACKUP}"

exit 0
