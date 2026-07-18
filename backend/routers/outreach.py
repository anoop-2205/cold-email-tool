"""Cold outreach emails to recruiters/HRs, sent via the candidate's own
connected Gmail. Draft first (AI-generated, editable), then send explicitly
-- never sent without the candidate reviewing it, per the plan's
human-in-the-loop principle.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Job, Outreach, Profile, get_db
from modules.cold_email import draft_cold_email
from modules.email_scanner import GmailAuthError
from modules.gmail_sender import send_cold_email
from modules.llm import LLMError
from modules.security import CurrentUser, require_auth

router = APIRouter(prefix="/api/outreach", tags=["outreach"])


class DraftRequest(BaseModel):
    job_id: int | None = None
    company: str = ""
    role_title: str = ""


class DraftOut(BaseModel):
    subject: str
    body: str


class SendRequest(BaseModel):
    job_id: int | None = None
    recruiter_emails: list[str]
    company: str = ""
    role_title: str = ""
    subject: str
    body: str
    attach_resume: bool = True


class OutreachOut(BaseModel):
    id: int
    job_id: int | None
    recruiter_email: str
    company: str
    role_title: str
    subject: str
    status: str
    resume_attached: bool
    sent_at: str

    class Config:
        from_attributes = True


class SendFailureOut(BaseModel):
    recruiter_email: str
    error: str


class SendBatchOut(BaseModel):
    sent: list[OutreachOut]
    failed: list[SendFailureOut]


def _require_profile(db: Session, user_id: int) -> Profile:
    profile = db.query(Profile).filter_by(user_id=user_id).first()
    # A Profile row can exist but be entirely empty (auto-created before the
    # candidate has filled anything in) -- that's functionally "no profile"
    # for drafting purposes, since the AI has nothing to write about.
    if not profile or not (profile.summary or profile.skills or profile.experience):
        raise HTTPException(400, "Fill in your profile (summary, skills, or experience) before drafting outreach emails")
    return profile


@router.post("/draft", response_model=DraftOut)
def draft(body: DraftRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    profile = _require_profile(db, current_user.id)

    company, role_title, description = body.company, body.role_title, ""
    if body.job_id:
        job = db.query(Job).filter_by(id=body.job_id, user_id=current_user.id).first()
        if not job:
            raise HTTPException(404, "Job not found")
        company, role_title, description = job.company, job.title, job.description

    if not company:
        raise HTTPException(400, "Provide a company (or a job_id) to draft an email for")

    try:
        result = draft_cold_email(profile, company, role_title, description)
    except LLMError as exc:
        raise HTTPException(502, f"AI drafting failed, try again: {exc}") from exc
    return DraftOut(**result)


@router.post("/send", response_model=SendBatchOut)
def send(body: SendRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    profile = _require_profile(db, current_user.id)

    if body.job_id:
        job = db.query(Job).filter_by(id=body.job_id, user_id=current_user.id).first()
        if not job:
            raise HTTPException(404, "Job not found")

    # Dedupe while preserving order, so picking the same inbound email twice
    # (or pasting a list with a repeat) doesn't send it twice.
    emails = list(dict.fromkeys(e.strip() for e in body.recruiter_emails if e.strip()))
    if not emails:
        raise HTTPException(400, "Provide at least one recruiter email")

    attachment_path = profile.resume_pdf_path if (body.attach_resume and profile.resume_pdf_path) else None

    sent: list[OutreachOut] = []
    failed: list[SendFailureOut] = []
    for recruiter_email in emails:
        try:
            message_id = send_cold_email(db, current_user.id, recruiter_email, body.subject, body.body, attachment_path)
        except GmailAuthError as exc:
            # Connection-level failure -- applies to every recipient, no point retrying the rest.
            raise HTTPException(400, str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 -- one bad address shouldn't sink the whole batch
            failed.append(SendFailureOut(recruiter_email=recruiter_email, error=str(exc)))
            continue

        record = Outreach(
            user_id=current_user.id,
            job_id=body.job_id,
            recruiter_email=recruiter_email,
            company=body.company,
            role_title=body.role_title,
            subject=body.subject,
            body=body.body,
            resume_attached=bool(attachment_path),
            gmail_message_id=message_id,
            status="sent",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        sent.append(
            OutreachOut(
                id=record.id,
                job_id=record.job_id,
                recruiter_email=record.recruiter_email,
                company=record.company,
                role_title=record.role_title,
                subject=record.subject,
                status=record.status,
                resume_attached=record.resume_attached,
                sent_at=record.sent_at.isoformat(),
            )
        )

    return SendBatchOut(sent=sent, failed=failed)


@router.get("", response_model=list[OutreachOut])
def list_outreach(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    rows = db.query(Outreach).filter_by(user_id=current_user.id).order_by(Outreach.sent_at.desc()).all()
    return [
        OutreachOut(
            id=r.id,
            job_id=r.job_id,
            recruiter_email=r.recruiter_email,
            company=r.company,
            role_title=r.role_title,
            subject=r.subject,
            status=r.status,
            resume_attached=r.resume_attached,
            sent_at=r.sent_at.isoformat(),
        )
        for r in rows
    ]
