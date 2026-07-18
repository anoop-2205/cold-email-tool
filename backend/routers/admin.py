"""Admin oversight: who signed up, who's built a profile, who's actually
using the agent. Read-only -- admins can see candidate activity but the
routers in profile.py/jobs.py/applications.py remain the only way to
mutate a candidate's own data.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Application, Job, Profile, User, get_db
from modules.security import CurrentUser, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UserSummaryOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str
    last_login_at: str | None
    has_profile: bool
    jobs_count: int
    applications_count: int


class UserDetailOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str
    last_login_at: str | None
    profile: dict | None
    jobs_count: int
    applications_count: int
    recent_jobs: list[dict]
    recent_applications: list[dict]


@router.get("/users", response_model=list[UserSummaryOut])
def list_users(db: Session = Depends(get_db), _admin: CurrentUser = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()

    jobs_counts = dict(db.query(Job.user_id, func.count(Job.id)).group_by(Job.user_id).all())
    app_counts = dict(
        db.query(Job.user_id, func.count(Application.id))
        .join(Application, Application.job_id == Job.id)
        .group_by(Job.user_id)
        .all()
    )

    out = []
    for u in users:
        out.append(
            UserSummaryOut(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                created_at=u.created_at.isoformat(),
                last_login_at=u.last_login_at.isoformat() if u.last_login_at else None,
                has_profile=u.profile is not None and bool(u.profile.resume_pdf_path),
                jobs_count=jobs_counts.get(u.id, 0),
                applications_count=app_counts.get(u.id, 0),
            )
        )
    return out


@router.get("/users/{user_id}", response_model=UserDetailOut)
def get_user_detail(user_id: int, db: Session = Depends(get_db), _admin: CurrentUser = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    profile = db.query(Profile).filter_by(user_id=user_id).first()
    jobs = db.query(Job).filter_by(user_id=user_id).order_by(Job.discovered_at.desc()).limit(10).all()
    applications = (
        db.query(Application)
        .join(Job)
        .filter(Job.user_id == user_id)
        .order_by(Application.applied_at.desc().nullslast())
        .limit(10)
        .all()
    )

    return UserDetailOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        profile=(
            {
                "full_name": profile.full_name,
                "email": profile.email,
                "location": profile.location,
                "summary": profile.summary,
                "skills": profile.skills,
            }
            if profile
            else None
        ),
        jobs_count=db.query(Job).filter_by(user_id=user_id).count(),
        applications_count=db.query(Application).join(Job).filter(Job.user_id == user_id).count(),
        recent_jobs=[
            {"id": j.id, "title": j.title, "company": j.company, "status": j.status, "match_score": j.match_score}
            for j in jobs
        ],
        recent_applications=[
            {"id": a.id, "job_id": a.job_id, "status": a.status, "applied_at": a.applied_at.isoformat() if a.applied_at else None}
            for a in applications
        ],
    )


class DeactivateResponse(BaseModel):
    id: int
    is_active: bool


@router.post("/users/{user_id}/toggle-active", response_model=DeactivateResponse)
def toggle_active(user_id: int, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    if user_id == admin.id:
        raise HTTPException(400, "You cannot deactivate your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = not user.is_active
    db.commit()
    return DeactivateResponse(id=user.id, is_active=user.is_active)
