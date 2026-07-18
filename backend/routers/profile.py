import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import RESUMES_DIR
from database import get_db, Profile
from modules.resume_parser import parse_resume
from modules.security import CurrentUser, require_auth

router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfileOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str
    location: str
    summary: str
    skills: list
    experience: list
    education: list
    projects: list
    resume_pdf_path: str

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    summary: str | None = None
    skills: list | None = None
    experience: list | None = None
    education: list | None = None
    projects: list | None = None


def _get_or_create(db: Session, user_id: int) -> Profile:
    profile = db.query(Profile).filter_by(user_id=user_id).first()
    if not profile:
        profile = Profile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.post("/upload", response_model=ProfileOut)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF resumes are supported")

    filename = f"{uuid.uuid4().hex}_{file.filename}"
    dest_path = RESUMES_DIR / filename
    with dest_path.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    try:
        parsed = parse_resume(str(dest_path))
    except Exception as exc:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(422, f"Could not parse resume: {exc}") from exc

    profile = _get_or_create(db, current_user.id)
    for field, value in parsed.items():
        setattr(profile, field, value)
    profile.resume_pdf_path = str(dest_path)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    return _get_or_create(db, current_user.id)


@router.put("", response_model=ProfileOut)
def update_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    profile = _get_or_create(db, current_user.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile
