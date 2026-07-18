"""Per-candidate Naukri login. No OAuth on Naukri's side (unlike Gmail), so
this stores the actual account password, encrypted at rest (modules/crypto.py).
Used by the scraper (modules/job_scraper.py) to log in as each candidate and
pull jobs into their own feed -- see main.py and routers/agent.py.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import User, get_db
from modules.crypto import encrypt
from modules.security import CurrentUser, require_auth

router = APIRouter(prefix="/api/naukri", tags=["naukri"])


class NaukriStatusOut(BaseModel):
    connected: bool
    username: str | None = None


class NaukriCredentialsIn(BaseModel):
    username: str
    password: str


@router.get("/status", response_model=NaukriStatusOut)
def status(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    user = db.get(User, current_user.id)
    return NaukriStatusOut(connected=bool(user.naukri_password_encrypted), username=user.naukri_username)


@router.put("/credentials", response_model=NaukriStatusOut)
def set_credentials(
    body: NaukriCredentialsIn, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)
):
    user = db.get(User, current_user.id)
    user.naukri_username = body.username
    user.naukri_password_encrypted = encrypt(body.password)
    db.commit()
    return NaukriStatusOut(connected=True, username=user.naukri_username)


@router.delete("/credentials", response_model=NaukriStatusOut)
def clear_credentials(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    user = db.get(User, current_user.id)
    user.naukri_username = None
    user.naukri_password_encrypted = None
    db.commit()
    return NaukriStatusOut(connected=False, username=None)
