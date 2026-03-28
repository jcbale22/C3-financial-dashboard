"""QBO API client with automatic token refresh."""
import base64
import time
import httpx
from fastapi import HTTPException

from app.config import settings
from app import tokens


def _refresh_tokens(token_data: dict) -> dict:
    credentials = f"{settings.qbo_client_id}:{settings.qbo_client_secret}"
    encoded = base64.b64encode(credentials.encode()).decode()

    with httpx.Client() as client:
        resp = client.post(
            settings.intuit_token_url,
            headers={
                "Authorization": f"Basic {encoded}",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            data={
                "grant_type": "refresh_token",
                "refresh_token": token_data["refresh_token"],
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Token refresh failed — re-authenticate at /auth/login")

    new_tokens = resp.json()
    new_tokens["expires_at"] = time.time() + new_tokens.get("expires_in", 3600)
    new_tokens.setdefault("realm_id", token_data.get("realm_id", ""))
    tokens.save_tokens(new_tokens)
    return new_tokens


def get_valid_token() -> tuple[str, str]:
    """Return (access_token, realm_id), refreshing if needed."""
    token_data = tokens.load_tokens()
    if not token_data:
        raise HTTPException(status_code=401, detail="Not authenticated — visit /auth/login")

    if tokens.is_token_expired(token_data):
        token_data = _refresh_tokens(token_data)

    realm_id = token_data.get("realm_id") or settings.qbo_company_id
    if not realm_id:
        raise HTTPException(status_code=400, detail="QBO company ID not set")

    return token_data["access_token"], realm_id


def qbo_get(path: str, params: dict | None = None) -> dict:
    """Make an authenticated GET request to QBO API."""
    access_token, realm_id = get_valid_token()
    url = f"{settings.qbo_base_url}/{realm_id}/{path}"

    with httpx.Client() as client:
        resp = client.get(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            params=params or {},
            timeout=30.0,
        )

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="QBO authentication expired — re-authenticate")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"QBO API error {resp.status_code}: {resp.text[:200]}")

    return resp.json()
