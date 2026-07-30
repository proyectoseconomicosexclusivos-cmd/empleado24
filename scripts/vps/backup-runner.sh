#!/bin/sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
export BACKUP_OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-/var/lib/empleado24/backups}"
retention="${BACKUP_RETENTION_DAYS:-14}"
while true; do
  if node scripts/backup-db.mjs; then
    find "$BACKUP_OUTPUT_DIR" -type f -mtime "+${retention}" -delete
  fi
  sleep 86400
done
