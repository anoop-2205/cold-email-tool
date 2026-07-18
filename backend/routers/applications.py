from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Application, Job
from modules.security import CurrentUser, require_auth

router = APIRouter(prefix="/api/applications", tags=["applications"])


class ApplicationOut(BaseModel):
    id: int
    job_id: int
    tailored_resume_path: str
    cover_letter_path: str
    applied_at: str | None = None
    screenshot_path: str
    status: str
    notes: str

    class Config:
        from_attributes = True


class ApplicationUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    follow_up_date: str | None = None


def _to_out(a: Application) -> ApplicationOut:
    return ApplicationOut(
        id=a.id,
        job_id=a.job_id,
        tailored_resume_path=a.tailored_resume_path,
        cover_letter_path=a.cover_letter_path,
        applied_at=a.applied_at.isoformat() if a.applied_at else None,
        screenshot_path=a.screenshot_path,
        status=a.status,
        notes=a.notes,
    )


@router.get("", response_model=list[ApplicationOut])
def list_applications(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    apps = (
        db.query(Application)
        .join(Job)
        .filter(Job.user_id == current_user.id)
        .order_by(Application.applied_at.desc().nullslast())
        .all()
    )
    return [_to_out(a) for a in apps]


@router.put("/{application_id}", response_model=ApplicationOut)
def update_application(
    application_id: int,
    body: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    app_ = (
        db.query(Application)
        .join(Job)
        .filter(Application.id == application_id, Job.user_id == current_user.id)
        .first()
    )
    if not app_:
        raise HTTPException(404, "Application not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(app_, field, value)
    db.commit()
    db.refresh(app_)
    return _to_out(app_)
