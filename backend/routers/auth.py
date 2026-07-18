from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db, utcnow, User
from modules.notifier import send_email_to
from modules.security import (
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    password_fingerprint,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    email: str


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if "@" not in body.email or "." not in body.email.split("@")[-1]:
        raise HTTPException(400, "Enter a valid email address")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.query(User).filter_by(email=body.email.lower()).first():
        raise HTTPException(409, "An account with this email already exists")

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role="candidate",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, user.role)
    return AuthResponse(access_token=token, role=user.role, full_name=user.full_name, email=user.email)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "This account has been deactivated")

    user.last_login_at = utcnow()
    db.commit()

    token = create_access_token(user.id, user.email, user.role)
    return AuthResponse(access_token=token, role=user.role, full_name=user.full_name, email=user.email)


class ForgotPasswordRequest(BaseModel):
    email: str


class ForgotPasswordResponse(BaseModel):
    message: str
    # Only set when SMTP isn't configured, so the flow is still testable
    # locally without setting up an email provider. Never set once SMTP is
    # configured -- at that point the link only ever goes out by email.
    dev_reset_link: str | None = None


GENERIC_FORGOT_MESSAGE = "If an account exists for that email, a reset link has been sent."


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email.lower()).first()
    if not user:
        # Same response whether or not the account exists, so this endpoint
        # can't be used to enumerate registered emails.
        return ForgotPasswordResponse(message=GENERIC_FORGOT_MESSAGE)

    token = create_password_reset_token(user.id, user.password_hash)
    reset_link = f"{settings.frontend_url}/reset-password?token={token}"
    body_text = (
        "Click the link below to set a new password. It expires in 30 minutes and can "
        f"only be used once.\n\n{reset_link}\n\nIf you didn't request this, ignore this email."
    )
    sent = send_email_to(user.email, "Reset your AutoApply Agent password", body_text)

    if sent or settings.environment == "production":
        # In production, never hand the reset token back in the API response
        # even if SMTP failed -- doing so would let anyone who knows a user's
        # email take over their account without ever touching their inbox.
        # A send failure here is a silent ops problem to fix server-side, not
        # something the caller should be able to work around.
        return ForgotPasswordResponse(message=GENERIC_FORGOT_MESSAGE)
    return ForgotPasswordResponse(message=GENERIC_FORGOT_MESSAGE, dev_reset_link=reset_link)


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    user_id, pwd_fp_claim = decode_password_reset_token(body.token)
    user = db.get(User, user_id)
    if not user or pwd_fp_claim != password_fingerprint(user.password_hash):
        raise HTTPException(400, "This reset link has already been used or is invalid")

    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated. You can now sign in with your new password."}
