from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Job
from modules.security import CurrentUser, require_auth

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class JobOut(BaseModel):
    id: int
    title: str
    company: str
    location: str
    description: str
    source: str
    source_url: str
    match_score: int | None
    match_reasons: list
    status: str

    class Config:
        from_attributes = True


class JobCreate(BaseModel):
    title: str
    company: str
    location: str = ""
    description: str = ""
    source: str = "manual"
    source_url: str = ""


def _get_owned_job(db: Session, job_id: int, user_id: int) -> Job:
    job = db.query(Job).filter_by(id=job_id, user_id=user_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.get("", response_model=list[JobOut])
def list_jobs(
    status: str | None = None,
    min_score: int = Query(0, alias="min_score"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    q = db.query(Job).filter(Job.user_id == current_user.id)
    if status:
        q = q.filter(Job.status == status)
    if min_score:
        q = q.filter(Job.match_score >= min_score)
    return q.order_by(Job.match_score.desc().nullslast(), Job.discovered_at.desc()).all()


@router.post("", response_model=JobOut)
def create_job(body: JobCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    from modules.job_scraper import job_hash

    h = job_hash(body.title, body.company, body.location)
    if db.query(Job).filter_by(hash=h, user_id=current_user.id).first():
        raise HTTPException(409, "This job already exists")
    job = Job(**body.model_dump(), hash=h, user_id=current_user.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/approve", response_model=JobOut)
def approve_job(job_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    job = _get_owned_job(db, job_id, current_user.id)
    job.status = "approved"
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/reject", response_model=JobOut)
def reject_job(job_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    job = _get_owned_job(db, job_id, current_user.id)
    job.status = "rejected"
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/apply")
def apply_to_job(job_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    from database import Profile
    from modules.auto_applier import apply_to_single_job

    job = _get_owned_job(db, job_id, current_user.id)
    profile = db.query(Profile).filter_by(user_id=current_user.id).first()
    if not profile:
        raise HTTPException(400, "Upload a resume/profile before applying")

    try:
        application = apply_to_single_job(db, profile, job)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"application_id": application.id, "status": application.status}
