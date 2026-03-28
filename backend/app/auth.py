"""QBO OAuth2 flow — authorization code grant."""
import secrets
import time
import base64
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse

from app.config import settings
from app import tokens

router = APIRouter(prefix="/auth", tags=["auth"])

QBO_SCOPES = "com.intuit.quickbooks.accounting"

# In-memory state store (single user, not distributed)
_pending_states: dict[str, float] = {}


@router.get("/login")
def login():
    """Redirect browser to Intuit OAuth consent screen."""
    state = secrets.token_urlsafe(16)
    _pending_states[state] = time.time()

    params = {
        "client_id": settings.qbo_client_id,
        "scope": QBO_SCOPES,
        "redirect_uri": settings.qbo_redirect_uri,
        "response_type": "code",
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"{settings.intuit_auth_url}?{query}")


@router.get("/callback")
def callback(code: str, state: str, realmId: str = ""):
    """Exchange authorization code for tokens."""
    if state not in _pending_states:
        raise HTTPException(status_code=400, detail="Invalid or expired state parameter")
    del _pending_states[state]

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
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.qbo_redirect_uri,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Token exchange failed: {resp.text}")

    token_data = resp.json()
    token_data["expires_at"] = time.time() + token_data.get("expires_in", 3600)
    if realmId:
        token_data["realm_id"] = realmId

    tokens.save_tokens(token_data)
    return RedirectResponse("https://finance.c3-church.com?auth=success")


@router.get("/status")
def auth_status():
    """Check whether we have valid tokens."""
    token_data = tokens.load_tokens()
    if not token_data:
        return {"authenticated": False}
    expired = tokens.is_token_expired(token_data)
    return {
        "authenticated": True,
        "expired": expired,
        "realm_id": token_data.get("realm_id", ""),
    }


@router.post("/logout")
def logout():
    """Revoke tokens and delete local token file."""
    token_data = tokens.load_tokens()
    if token_data:
        credentials = f"{settings.qbo_client_id}:{settings.qbo_client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        with httpx.Client() as client:
            client.post(
                settings.intuit_revoke_url,
                headers={"Authorization": f"Basic {encoded}", "Accept": "application/json"},
                json={"token": token_data.get("refresh_token", "")},
            )
        import os
        from app.tokens import TOKEN_FILE
        if TOKEN_FILE.exists():
            os.remove(TOKEN_FILE)
    return {"status": "logged out"}
