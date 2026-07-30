#!/bin/sh
set -eu
: "${RESTORE_CHECK_DATABASE_URL:?RESTORE_CHECK_DATABASE_URL is required}"
archive="$(find "${BACKUP_OUTPUT_DIR:-/var/lib/empleado24/backups}" -name '*.sql.gz' -type f -print | sort | tail -n 1)"
test -n "$archive"
node scripts/restore-db.mjs "$archive" "$RESTORE_CHECK_DATABASE_URL"
