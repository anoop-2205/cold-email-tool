"""JWT auth, multi-user with roles.

Two roles: "admin" (oversight dashboard, sees all users' activity) and
"candidate" (their own profile/jobs/applications only). The JWT carries
user id + role so routers can scope queries without a DB round-trip on
every request.
"""
import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext

from config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: int
    email: str
    role: str


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: int, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    payload = {"sub": str(user_id), "email": email, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def require_auth(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc
    return CurrentUser(id=int(payload["sub"]), email=payload["email"], role=payload["role"])


def require_admin(current_user: CurrentUser = Depends(require_auth)) -> CurrentUser:
    if current_user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return current_user


# --- OAuth "state" signing -------------------------------------------------
# The Gmail OAuth redirect flow round-trips through Google, which echoes
# back whatever `state` we send unmodified. Signing it (short-lived, single
# purpose) stops an attacker from hand-crafting a state that attaches THEIR
# Gmail consent to a DIFFERENT user's account.
def create_oauth_state(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {"sub": str(user_id), "purpose": "gmail_oauth", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_oauth_state(state: str) -> int:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OAuth state") from exc
    if payload.get("purpose") != "gmail_oauth":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid OAuth state")
    return int(payload["sub"])


# --- Password reset tokens ---------------------------------------------------
# Signed + short-lived (30 min) like the OAuth state above. Also carries a
# fingerprint of the CURRENT password hash at issue time, so the token
# self-invalidates the moment the password actually changes -- no separate
# "used tokens" table needed to stop a reset link being replayed. Verifying
# the fingerprint requires the user's row (looked up by the decoded id), so
# this is split into decode-then-compare rather than one verify() call.
def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_password_reset_token(user_id: int, current_password_hash: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    payload = {
        "sub": str(user_id),
        "purpose": "password_reset",
        "pwd_fp": password_fingerprint(current_password_hash),
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_password_reset_token(token: str) -> tuple[int, str]:
    """Returns (user_id, pwd_fp_claim). Caller loads the user and compares
    pwd_fp_claim against password_fingerprint(user.password_hash) -- a
    mismatch means the password already changed since this link was sent."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired") from exc
    if payload.get("purpose") != "password_reset":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid")
    return int(payload["sub"]), payload.get("pwd_fp", "")
