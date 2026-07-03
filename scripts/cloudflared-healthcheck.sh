#!/bin/bash
set -euo pipefail

# Daily Cloudflare tunnel healthcheck + retention cleanup
# Writes one line per run to a rolling log file for historical visibility.

TUNNEL_ID="${TUNNEL_ID:-5f6cf48d-2fc7-4a6f-87d9-5bcd24dad584}"
LOG_DIR="${LOG_DIR:-$HOME/.cloudflared/health}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
PUBLIC_URL="${PUBLIC_URL:-https://finance.c3-church.com}"
LOCAL_FRONTEND_URL="${LOCAL_FRONTEND_URL:-http://localhost:31337}"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/healthcheck-$(date +%F).log"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

status="ok"
notes=()

find_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    command -v cloudflared
    return 0
  fi
  for p in /opt/homebrew/bin/cloudflared /usr/local/bin/cloudflared /usr/bin/cloudflared; do
    if [ -x "$p" ]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

CLOUDFLARED_BIN="$(find_cloudflared || true)"

if [ -z "$CLOUDFLARED_BIN" ]; then
  status="fail"
  notes+=("cloudflared_missing")
else
  # Service state on macOS launchd; do not fail hard on non-macOS.
  if launchctl print system/com.cloudflare.cloudflared >/dev/null 2>&1; then
    :
  else
    notes+=("service_not_running")
    status="warn"
  fi

  # API call requires valid cert/account context; capture auth issues separately.
  if "$CLOUDFLARED_BIN" tunnel info "$TUNNEL_ID" >/tmp/cloudflared-tunnel-info.$$ 2>/tmp/cloudflared-tunnel-info.err.$$; then
    if grep -qi "does not have any active connection" /tmp/cloudflared-tunnel-info.$$; then
      status="fail"
      notes+=("no_active_connection")
    fi
  else
    err="$(tr '\n' ' ' </tmp/cloudflared-tunnel-info.err.$$)"
    if echo "$err" | grep -qi "Authentication error"; then
      status="fail"
      notes+=("auth_error")
    else
      status="fail"
      notes+=("tunnel_info_failed")
    fi
  fi
  rm -f /tmp/cloudflared-tunnel-info.$$ /tmp/cloudflared-tunnel-info.err.$$
fi

if ! curl -fsS --max-time 8 "$LOCAL_FRONTEND_URL" >/dev/null; then
  status="fail"
  notes+=("local_frontend_unreachable")
fi

if ! curl -fsS --max-time 12 "$PUBLIC_URL" >/dev/null; then
  status="fail"
  notes+=("public_unreachable")
fi

if [ ${#notes[@]} -eq 0 ]; then
  note_str="healthy"
else
  note_str="$(IFS=,; echo "${notes[*]}")"
fi

echo "$TIMESTAMP status=$status notes=$note_str tunnel_id=$TUNNEL_ID" >>"$LOG_FILE"

# Prune old logs based on retention.
find "$LOG_DIR" -type f -name 'healthcheck-*.log' -mtime "+$RETENTION_DAYS" -delete

# Non-zero exit for monitoring integration.
if [ "$status" = "fail" ]; then
  exit 1
fi

exit 0
