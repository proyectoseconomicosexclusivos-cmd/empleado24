#!/bin/sh
set -eu
: "${APP_URL:?APP_URL is required}"
: "${CRON_SECRET:?CRON_SECRET is required}"

call() {
  path="$1"
  curl --fail --silent --show-error --max-time 50 -H "Authorization: Bearer ${CRON_SECRET}" "${CRON_TARGET_URL:-$APP_URL}${path}" >/dev/null
}

minute=0
while true; do
  call "/api/cron/process-webhook-queue" || true
  if [ $((minute % 5)) -eq 0 ]; then
    call "/api/cron/reconcile-calls" || true
    call "/api/cron/release-guardian" || true
  fi
  if [ $((minute % 60)) -eq 0 ]; then call "/api/cron/analytics-rollup" || true; fi
  if [ $((minute % 1440)) -eq 0 ]; then call "/api/cron/release-guardian?mode=daily" || true; fi
  if [ $((minute % 10080)) -eq 0 ]; then call "/api/cron/release-guardian?mode=weekly" || true; fi
  minute=$((minute + 1))
  sleep 60
done
