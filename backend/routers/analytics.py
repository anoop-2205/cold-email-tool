from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import Application, Job, get_db, utcnow
from modules.security import CurrentUser, require_auth

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary")
def analytics_summary(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    applications = db.query(Application).join(Job).filter(Job.user_id == current_user.id).all()
    jobs = db.query(Job).filter(Job.user_id == current_user.id).all()

    applied = [a for a in applications if a.applied_at]
    per_day = Counter(a.applied_at.date().isoformat() for a in applied)
    since_30 = utcnow() - timedelta(days=30)
    recent = [a for a in applied if a.applied_at >= since_30]

    responded = [a for a in applied if a.status not in ("submitted", "pending", "dry_run", "failed")]
    response_rate = round(len(responded) / len(applied) * 100, 1) if applied else 0.0

    top_companies = Counter(a.job.company for a in applied if a.job)

    return {
        "total_jobs_discovered": len(jobs),
        "total_applications": len(applied),
        "applications_last_30_days": len(recent),
        "applications_per_day": dict(per_day),
        "response_rate_percent": response_rate,
        "status_breakdown": dict(Counter(a.status for a in applied)),
        "top_companies": top_companies.most_common(10),
    }
