"""Per-user Gmail OAuth connect/disconnect. The actual scanning lives in
modules/email_scanner.py; this router only manages the consent handshake
and connection status.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import User, get_db
from modules.email_scanner import GmailAuthError, exchange_code_for_credentials, get_authorization_url
from modules.security import CurrentUser, require_auth, verify_oauth_state

router = APIRouter(prefix="/api/gmail", tags=["gmail"])


class ConnectUrlOut(BaseModel):
    auth_url: str


class GmailStatusOut(BaseModel):
    connected: bool
    email: str | None = None


@router.get("/connect", response_model=ConnectUrlOut)
def connect(current_user: CurrentUser = Depends(require_auth)):
    try:
        return ConnectUrlOut(auth_url=get_authorization_url(current_user.id))
    except GmailAuthError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/callback")
def callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if error or not code or not state:
        return RedirectResponse(f"{settings.frontend_url}/inbox?gmail=denied")

    user_id = verify_oauth_state(state)
    try:
        creds = exchange_code_for_credentials(code)
    except Exception:  # noqa: BLE001 -- any exchange failure just bounces back to the UI
        return RedirectResponse(f"{settings.frontend_url}/inbox?gmail=error")

    from googleapiclient.discovery import build

    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()

    user = db.get(User, user_id)
    if not user:
        return RedirectResponse(f"{settings.frontend_url}/inbox?gmail=error")

    user.gmail_token_json = creds.to_json()
    user.gmail_email = profile.get("emailAddress", "")
    db.commit()

    return RedirectResponse(f"{settings.frontend_url}/inbox?gmail=connected")


@router.get("/status", response_model=GmailStatusOut)
def status(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    user = db.get(User, current_user.id)
    return GmailStatusOut(connected=bool(user.gmail_token_json), email=user.gmail_email)


@router.post("/disconnect", response_model=GmailStatusOut)
def disconnect(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    user = db.get(User, current_user.id)
    user.gmail_token_json = None
    user.gmail_email = None
    db.commit()
    return GmailStatusOut(connected=False, email=None)
