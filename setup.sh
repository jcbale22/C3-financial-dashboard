#!/bin/bash
set -e

echo "=== C3 Financial Dashboard — Setup ==="

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "[1/4] Docker not found. Installing..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install --cask docker
    echo "      Docker Desktop installed. Open it once to complete setup, then re-run this script."
    exit 0
  else
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "      Docker installed. Log out and back in, then re-run this script."
    exit 0
  fi
else
  echo "[1/4] Docker already installed. ✓"
fi

# ── cloudflared ───────────────────────────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
  echo "[2/4] cloudflared not found. Installing..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install cloudflared
  else
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
      | sudo tee /etc/apt/sources.list.d/cloudflared.list
    sudo apt update && sudo apt install -y cloudflared
  fi
  echo "      cloudflared installed. ✓"
else
  echo "[2/4] cloudflared already installed. ✓"
fi

# ── Tunnel credentials ────────────────────────────────────────────────────────
if [ ! -f "$HOME/.cloudflared/config.yml" ]; then
  echo ""
  echo "[3/4] Tunnel credentials not found at ~/.cloudflared/"
  echo "      Copy them from the original machine:"
  echo "        scp -r user@original-machine.local:~/.cloudflared ~/.cloudflared"
  echo "      Then re-run this script."
  exit 1
else
  echo "[3/4] Tunnel credentials found. ✓"
fi

# ── .env file ─────────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo ""
  echo "      .env file not found. Copy it from the original machine:"
  echo "        scp user@original-machine.local:/path/to/C3_Financial_Dashboard/.env ."
  echo "      Then re-run this script."
  exit 1
fi

# ── tokens.json ───────────────────────────────────────────────────────────────
if [ ! -f "tokens.json" ]; then
  echo "      tokens.json not found — creating empty placeholder."
  echo "{}" > tokens.json
fi

# ── Build and start containers ────────────────────────────────────────────────
echo "[4/4] Building and starting Docker containers..."
docker compose up --build -d
echo "      Containers started. ✓"

# ── Install cloudflared as a service ─────────────────────────────────────────
echo ""
echo "Installing cloudflared as a startup service..."
sudo cloudflared service install
echo "cloudflared service installed. ✓"

echo ""
echo "=== Setup complete ==="
echo "    Frontend: http://localhost:31337"
echo "    Backend:  http://localhost:8000"
echo "    Public:   https://finance.c3-church.com"
