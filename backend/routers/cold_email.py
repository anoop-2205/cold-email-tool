"""Custom cold email: canned templates sent to one or more recruiters at
once via the candidate's own connected Gmail. Distinct from
routers/outreach.py, which is job-tied, AI-drafted, and single-recipient.
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import ColdEmail, Profile, get_db
from modules.cold_email import draft_full_cold_email
from modules.email_scanner import GmailAuthError
from modules.gmail_sender import send_cold_email
from modules.llm import LLMError
from modules.security import CurrentUser, require_auth

router = APIRouter(prefix="/api/cold-email", tags=["cold-email"])


class DraftRequest(BaseModel):
    company: str = ""
    role_title: str = ""
    recipient_name: str = ""


class DraftOut(BaseModel):
    subject: str
    body: str


class SendRequest(BaseModel):
    recruiter_emails: list[str]
    template: str = ""
    subject: str
    body: str
    attach_resume: bool = True


class ColdEmailOut(BaseModel):
    id: int
    recruiter_email: str
    template: str
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
    sent: list[ColdEmailOut]
    failed: list[SendFailureOut]


@router.post("/draft", response_model=DraftOut)
def draft(body: DraftRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    profile = db.query(Profile).filter_by(user_id=current_user.id).first()
    if not profile or not (profile.summary or profile.skills or profile.experience):
        raise HTTPException(400, "Fill in your profile (summary, skills, or experience) before drafting with AI")

    try:
        result = draft_full_cold_email(profile, body.company, body.role_title, body.recipient_name)
    except LLMError as exc:
        raise HTTPException(502, f"AI drafting failed, try again: {exc}") from exc
    return DraftOut(**result)


@router.post("/send", response_model=SendBatchOut)
def send(body: SendRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    # Dedupe while preserving order, so pasting a list with a repeat doesn't send it twice.
    emails = list(dict.fromkeys(e.strip() for e in body.recruiter_emails if e.strip()))
    if not emails:
        raise HTTPException(400, "Provide at least one recruiter email")

    profile = db.query(Profile).filter_by(user_id=current_user.id).first()
    attachment_path = profile.resume_pdf_path if (body.attach_resume and profile and profile.resume_pdf_path) else None
    if body.attach_resume and not attachment_path:
        raise HTTPException(400, "No resume on file -- upload one on the Profile page first, or uncheck \"Attach my resume\".")
    if attachment_path and not Path(attachment_path).exists():
        # Fail the whole batch up front rather than silently sending every
        # recipient an email without the resume it claims to have attached.
        raise HTTPException(400, "Your saved resume file is missing on the server -- re-upload it on the Profile page.")

    sent: list[ColdEmailOut] = []
    failed: list[SendFailureOut] = []
    for recruiter_email in emails:
        try:
            message_id, resume_attached = send_cold_email(
                db, current_user.id, recruiter_email, body.subject, body.body, attachment_path
            )
        except GmailAuthError as exc:
            # Connection-level failure -- applies to every recipient, no point retrying the rest.
            raise HTTPException(400, str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 -- one bad address shouldn't sink the whole batch
            failed.append(SendFailureOut(recruiter_email=recruiter_email, error=str(exc)))
            continue

        record = ColdEmail(
            user_id=current_user.id,
            recruiter_email=recruiter_email,
            template=body.template,
            subject=body.subject,
            body=body.body,
            resume_attached=resume_attached,
            gmail_message_id=message_id,
            status="sent",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        sent.append(
            ColdEmailOut(
                id=record.id,
                recruiter_email=record.recruiter_email,
                template=record.template,
                subject=record.subject,
                status=record.status,
                resume_attached=record.resume_attached,
                sent_at=record.sent_at.isoformat(),
            )
        )

    return SendBatchOut(sent=sent, failed=failed)


@router.get("", response_model=list[ColdEmailOut])
def list_cold_emails(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    rows = db.query(ColdEmail).filter_by(user_id=current_user.id).order_by(ColdEmail.sent_at.desc()).all()
    return [
        ColdEmailOut(
            id=r.id,
            recruiter_email=r.recruiter_email,
            template=r.template,
            subject=r.subject,
            status=r.status,
            resume_attached=r.resume_attached,
            sent_at=r.sent_at.isoformat(),
        )
        for r in rows
    ]
