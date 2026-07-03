#!/bin/bash
set -euo pipefail

# Safe validation for dev machines.
# Does not start/stop services, does not call launchctl, and does not run Docker.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Bash syntax checks"
bash -n setup.sh \
  scripts/cloudflared-preflight.sh \
  scripts/cloudflared-healthcheck.sh \
  scripts/install-healthcheck-launchd.sh \
  scripts/prepush-validate.sh

echo "[2/4] Verify required script files exist"
for f in \
  scripts/cloudflared-preflight.sh \
  scripts/cloudflared-healthcheck.sh \
  scripts/install-healthcheck-launchd.sh
  do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing $f"
    exit 1
  fi
done

echo "[3/4] Verify setup contains preflight gate"
if ! grep -q "./scripts/cloudflared-preflight.sh" setup.sh; then
  echo "ERROR: setup.sh missing cloudflared preflight call"
  exit 1
fi

echo "[4/4] Optional local config sanity (non-fatal)"
if [ -f "$HOME/.cloudflared/config.yml" ]; then
  tunnel_id="$(awk -F': ' '/^tunnel:/ {print $2; exit}' "$HOME/.cloudflared/config.yml" | tr -d '[:space:]')"
  if [ -n "$tunnel_id" ]; then
    echo "Found tunnel in local config: $tunnel_id"
  else
    echo "WARN: ~/.cloudflared/config.yml exists but no tunnel id found"
  fi
else
  echo "WARN: ~/.cloudflared/config.yml not present on this dev machine"
fi

echo "PASS: pre-push validation succeeded (safe mode)"
