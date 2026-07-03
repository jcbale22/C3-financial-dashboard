#!/bin/bash
set -euo pipefail

# Installs a user LaunchAgent to run the daily tunnel healthcheck.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHECK_SCRIPT="$SCRIPT_DIR/cloudflared-healthcheck.sh"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/com.c3.financedashboard.tunnel-healthcheck.plist"
LOG_DIR="$HOME/.cloudflared/health"

mkdir -p "$PLIST_DIR" "$LOG_DIR"
chmod +x "$CHECK_SCRIPT"

cat >"$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.c3.financedashboard.tunnel-healthcheck</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$CHECK_SCRIPT</string>
  </array>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>6</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd.err.log</string>

  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

echo "Installed LaunchAgent: $PLIST_PATH"
echo "Health logs: $LOG_DIR"
echo "Current jobs:"
launchctl list | grep com.c3.financedashboard.tunnel-healthcheck || true
