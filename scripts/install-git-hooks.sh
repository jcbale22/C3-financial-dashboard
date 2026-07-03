#!/bin/bash
set -euo pipefail

# Configure repo-local hooks path and verify pre-push hook is installed.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

git config core.hooksPath .githooks

echo "Configured core.hooksPath to .githooks"
echo "Installed hooks:"
ls -l .githooks

echo "Current git hooksPath:"
git config --get core.hooksPath
