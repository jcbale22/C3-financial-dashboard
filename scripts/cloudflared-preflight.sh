#!/bin/bash
set -euo pipefail

# Preflight gate: verifies tunnel cert + credentials files before app startup.

CF_DIR="${CF_DIR:-$HOME/.cloudflared}"
CONFIG_FILE="$CF_DIR/config.yml"
CERT_FILE="$CF_DIR/cert.pem"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: Missing $CONFIG_FILE"
  echo "Copy ~/.cloudflared from a known-good machine or run cloudflared tunnel login."
  exit 1
fi

if [ ! -f "$CERT_FILE" ]; then
  echo "ERROR: Missing $CERT_FILE"
  echo "Run: cloudflared tunnel login"
  exit 1
fi

# Parse tunnel ID from config.yml
TUNNEL_ID="$(awk -F': ' '/^tunnel:/ {print $2; exit}' "$CONFIG_FILE" | tr -d '[:space:]')"
if [ -z "$TUNNEL_ID" ]; then
  echo "ERROR: Could not read tunnel ID from $CONFIG_FILE"
  exit 1
fi

CRED_FILE="$CF_DIR/$TUNNEL_ID.json"
if [ ! -f "$CRED_FILE" ]; then
  echo "ERROR: Missing tunnel credential file $CRED_FILE"
  echo "Expected from config tunnel ID: $TUNNEL_ID"
  exit 1
fi

# Soft validation: ensure credential file appears to belong to same tunnel ID.
if ! grep -q "$TUNNEL_ID" "$CRED_FILE"; then
  echo "ERROR: Credential file $CRED_FILE does not contain expected tunnel ID $TUNNEL_ID"
  echo "Possible stale or mismatched credential set in ~/.cloudflared"
  exit 1
fi

echo "cloudflared preflight OK (tunnel $TUNNEL_ID)"
