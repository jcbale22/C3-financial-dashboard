#!/bin/bash
set -euo pipefail

# One-command Cloudflare tunnel recovery for macOS.
# Usage:
#   bash scripts/recover-cloudflared.sh
#   bash scripts/recover-cloudflared.sh --tunnel-id <uuid>
#   bash scripts/recover-cloudflared.sh --reauth

TUNNEL_ID="5f6cf48d-2fc7-4a6f-87d9-5bcd24dad584"
REAUTH="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tunnel-id)
      TUNNEL_ID="$2"
      shift 2
      ;;
    --reauth)
      REAUTH="true"
      shift
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

log() {
  echo "[recover-cloudflared] $*"
}

find_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    command -v cloudflared
    return 0
  fi
  for p in /opt/homebrew/bin/cloudflared /usr/local/bin/cloudflared /usr/bin/cloudflared; do
    if [[ -x "$p" ]]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

CF_BIN="$(find_cloudflared || true)"
if [[ -z "$CF_BIN" ]]; then
  log "cloudflared binary not found. Install first (brew install cloudflared)."
  exit 1
fi

log "Using cloudflared: $CF_BIN"

if [[ "$REAUTH" == "true" ]]; then
  log "Re-auth requested. Backing up cert and running login..."
  mv "$HOME/.cloudflared/cert.pem" "$HOME/.cloudflared/cert.pem.bak" 2>/dev/null || true
  "$CF_BIN" tunnel login
fi

check_tunnel() {
  "$CF_BIN" tunnel info "$TUNNEL_ID" 2>&1 | tee /tmp/cloudflared-tunnel-info.out
}

has_active_connection() {
  ! grep -qi "does not have any active connection" /tmp/cloudflared-tunnel-info.out
}

auth_error() {
  grep -qi "Authentication error" /tmp/cloudflared-tunnel-info.out
}

log "Trying service kickstart..."
sudo launchctl kickstart -k system/com.cloudflare.cloudflared || true
sleep 2

log "Checking tunnel connector status..."
check_tunnel || true
if has_active_connection; then
  log "Tunnel is active. Done."
  exit 0
fi

if auth_error; then
  log "Authentication error detected. Re-running login..."
  mv "$HOME/.cloudflared/cert.pem" "$HOME/.cloudflared/cert.pem.bak" 2>/dev/null || true
  "$CF_BIN" tunnel login
fi

log "Attempting bootout/bootstrap recovery..."
sudo launchctl bootout system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist || true
if ! sudo launchctl bootstrap system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist; then
  log "bootstrap failed (this can happen on broken launchd state). Continuing with fallback..."
fi
sudo launchctl kickstart -k system/com.cloudflare.cloudflared || true
sleep 3

log "Re-checking tunnel connector status..."
check_tunnel || true
if has_active_connection; then
  log "Tunnel is active after service recovery. Done."
  exit 0
fi

log "No active connector yet. Starting emergency foreground connector in background..."
mkdir -p "$HOME/.cloudflared"
nohup "$CF_BIN" tunnel run "$TUNNEL_ID" > "$HOME/.cloudflared/recovery-run.log" 2>&1 &
sleep 5

log "Final tunnel check..."
check_tunnel || true
if has_active_connection; then
  log "Tunnel is active via recovery-run. Site should recover now."
  log "Emergency log: $HOME/.cloudflared/recovery-run.log"
  exit 0
fi

log "Still no active connection. Open this log and share first error lines:"
log "  $HOME/.cloudflared/recovery-run.log"
exit 1
