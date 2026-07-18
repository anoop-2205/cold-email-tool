from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, EmailScan
from modules.security import CurrentUser, require_auth

router = APIRouter(prefix="/api/email", tags=["email-intelligence"])


class EmailScanOut(BaseModel):
    id: int
    from_address: str
    subject: str
    classification: str
    extracted_data: dict
    linked_job_id: int | None
    linked_application_id: int | None

    class Config:
        from_attributes = True


@router.get("/recent", response_model=list[EmailScanOut])
def recent_scans(limit: int = 50, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    # Excludes IRRELEVANT so personal mail that only matched the broad Gmail
    # search query (e.g. subject happens to contain "offer" or "interview")
    # doesn't show up next to real job-related scans.
    return (
        db.query(EmailScan)
        .filter(EmailScan.user_id == current_user.id, EmailScan.classification != "IRRELEVANT")
        .order_by(EmailScan.scanned_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/inbound", response_model=list[EmailScanOut])
def inbound_opportunities(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    return (
        db.query(EmailScan)
        .filter(EmailScan.user_id == current_user.id, EmailScan.classification == "RECRUITER_OUTREACH")
        .order_by(EmailScan.scanned_at.desc())
        .all()
    )
