#!/bin/bash
set -euo pipefail

# Prod deployment helper (run on the prod host after git pull).
# Idempotent: re-validates cloudflared credentials, rebuilds containers,
# ensures cloudflared service exists, installs daily healthcheck job,
# and records an immediate healthcheck entry.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

chmod +x setup.sh scripts/*.sh .githooks/pre-push 2>/dev/null || true

./setup.sh
./scripts/install-healthcheck-launchd.sh
./scripts/cloudflared-healthcheck.sh || true

echo "Prod deploy steps complete."
echo "Check health logs at: $HOME/.cloudflared/health"
