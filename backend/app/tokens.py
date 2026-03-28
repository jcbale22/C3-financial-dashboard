"""Simple file-based token store. Single-org app — no multi-tenant complexity needed."""
import json
import time
from pathlib import Path

TOKEN_FILE = Path("tokens.json")


def save_tokens(token_data: dict) -> None:
    TOKEN_FILE.write_text(json.dumps(token_data, indent=2))


def load_tokens() -> dict | None:
    if not TOKEN_FILE.exists():
        return None
    return json.loads(TOKEN_FILE.read_text())


def is_authenticated() -> bool:
    tokens = load_tokens()
    return tokens is not None and "access_token" in tokens


def is_token_expired(tokens: dict) -> bool:
    expires_at = tokens.get("expires_at", 0)
    return time.time() >= expires_at - 60  # 60s buffer
