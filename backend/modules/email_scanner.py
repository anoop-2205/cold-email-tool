"""Feature 1-3: Email Intelligence Engine (Gmail scanning), per-user OAuth.

Each candidate connects their OWN Gmail via routers/gmail.py (an OAuth2 web
flow through Google), and their resulting token is stored on their User row
(gmail_token_json) -- there's no shared inbox. Everything still runs
locally: Gmail API calls go straight from this machine to Google, no
middleman server. Scope is read + send (gmail.readonly + gmail.send) --
enough to scan the inbox and send cold emails/replies as the candidate,
but never delete, modify existing mail, or manage labels.

get_gmail_service_for_user() is the shared entry point other modules
(modules/gmail_sender.py) use too, so there's one place that knows how to
turn a User row into an authenticated Gmail API client.

Setup (see README): create a Web application OAuth2 client in Google Cloud
Console with GMAIL_REDIRECT_URI as an authorized redirect URI, download as
backend/config/credentials.json.
"""
import base64
import json
from datetime import timezone as _dt_timezone
from email.utils import parsedate_to_datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from config import settings
from database import Application, EmailScan, Job, User, utcnow
from modules.email_classifier import CLASSIFICATION_TO_APPLICATION_STATUS, classify_email
from modules.job_scraper import job_hash
from modules.llm import LLMError
from modules.security import create_oauth_state

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
]

# Broad net: job boards for alerts, plus a generic job-related keyword
# search so recruiter/response emails from arbitrary company domains are
# still picked up.
SEARCH_QUERY = (
    "(from:(naukri.com OR linkedin.com OR indeed.com OR wellfound.com OR jobs.google.com) "
    "OR subject:(interview OR application OR assessment OR offer OR recruiter))"
)


class GmailAuthError(RuntimeError):
    pass


def _require_credentials_file() -> None:
    if not settings.gmail_credentials_path.exists():
        raise GmailAuthError(
            f"Missing {settings.gmail_credentials_path}. Create a Web application OAuth2 client in "
            "console.cloud.google.com (with GMAIL_REDIRECT_URI as an authorized redirect URI) and save "
            "its downloaded JSON there."
        )


def _build_flow() -> Flow:
    _require_credentials_file()
    return Flow.from_client_secrets_file(
        str(settings.gmail_credentials_path), scopes=SCOPES, redirect_uri=settings.gmail_redirect_uri
    )


def get_authorization_url(user_id: int) -> str:
    """Return the Google consent URL for this user to visit. `state` is a
    signed, short-lived token so the callback can trust which user it's for."""
    flow = _build_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",  # forces a refresh_token even on repeat connects
        include_granted_scopes="true",
        state=create_oauth_state(user_id),
    )
    return auth_url


def exchange_code_for_credentials(code: str) -> Credentials:
    flow = _build_flow()
    flow.fetch_token(code=code)
    return flow.credentials


def get_gmail_service_for_user(db: Session, user_id: int):
    user = db.get(User, user_id)
    if not user or not user.gmail_token_json:
        raise GmailAuthError("Gmail is not connected for this account yet.")

    creds = Credentials.from_authorized_user_info(json.loads(user.gmail_token_json), SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            user.gmail_token_json = creds.to_json()
            db.commit()
        else:
            raise GmailAuthError("Gmail connection expired. Please reconnect.")

    return build("gmail", "v1", credentials=creds)


def _decode_body(payload: dict) -> str:
    def walk(part: dict) -> str:
        if part.get("mimeType") == "text/plain" and "data" in part.get("body", {}):
            return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
        for sub in part.get("parts", []) or []:
            text = walk(sub)
            if text:
                return text
        return ""

    return walk(payload)


def _header(headers: list[dict], name: str) -> str:
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def _link_to_job_or_application(db: Session, user_id: int, classification: str, extracted: dict) -> tuple[int | None, int | None]:
    company = (extracted.get("company") or "").strip()
    if not company:
        return None, None

    if classification in CLASSIFICATION_TO_APPLICATION_STATUS:
        application = (
            db.query(Application)
            .join(Job)
            .filter(Job.user_id == user_id, Job.company.ilike(f"%{company}%"))
            .order_by(Application.applied_at.desc())
            .first()
        )
        if application:
            application.status = CLASSIFICATION_TO_APPLICATION_STATUS[classification]
            application.response_date = utcnow()
            db.commit()
            return application.job_id, application.id

    return None, None


def _create_job_alert(db: Session, user_id: int, extracted: dict, source_url: str) -> int | None:
    title = (extracted.get("job_title") or "").strip()
    company = (extracted.get("company") or "").strip()
    if not title or not company:
        return None
    h = job_hash(title, company, "")
    existing = db.query(Job).filter_by(hash=h, user_id=user_id).first()
    if existing:
        return existing.id
    job = Job(user_id=user_id, title=title, company=company, location="", description=extracted.get("notes", ""),
               source="email-alert", source_url=source_url or extracted.get("link", ""), hash=h)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job.id


def scan_inbox(db: Session, user_id: int, max_results: int = 50) -> list[EmailScan]:
    """Fetch this user's unseen matching emails, classify each, persist as
    EmailScan rows scoped to them. Returns the newly created rows
    (already-scanned messages are skipped by gmail_msg_id so this is safe
    to run on a schedule)."""
    service = get_gmail_service_for_user(db, user_id)
    response = service.users().messages().list(userId="me", q=SEARCH_QUERY, maxResults=max_results).execute()
    message_refs = response.get("messages", [])

    new_scans: list[EmailScan] = []
    for ref in message_refs:
        msg_id = ref["id"]
        if db.query(EmailScan).filter_by(gmail_msg_id=msg_id, user_id=user_id).first():
            continue

        message = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
        headers = message["payload"].get("headers", [])
        subject = _header(headers, "Subject")
        from_address = _header(headers, "From")
        date_header = _header(headers, "Date")
        try:
            received_at = parsedate_to_datetime(date_header) if date_header else None
            # parsedate_to_datetime returns a tz-aware datetime; strip tzinfo so it's
            # comparable with the naive-UTC datetimes used everywhere else (see database.utcnow).
            if received_at is not None and received_at.tzinfo is not None:
                received_at = received_at.astimezone(_dt_timezone.utc).replace(tzinfo=None)
        except (TypeError, ValueError):
            received_at = None
        body = _decode_body(message["payload"]) or message.get("snippet", "")

        try:
            result = classify_email(subject, from_address, body)
        except LLMError as exc:
            # A message that fails classification must still get an EmailScan
            # row -- otherwise it's never marked "seen" and this same message
            # re-fails (and re-blocks everything after it) on every future
            # scan cycle. Fall back to IRRELEVANT rather than losing the batch.
            result = {
                "classification": "IRRELEVANT",
                "extracted_data": {"job_title": "", "company": "", "link": "", "date": "", "notes": f"Classification failed: {exc}"},
            }
        linked_job_id, linked_application_id = _link_to_job_or_application(
            db, user_id, result["classification"], result["extracted_data"]
        )
        if result["classification"] == "JOB_ALERT" and linked_job_id is None:
            linked_job_id = _create_job_alert(db, user_id, result["extracted_data"], "")

        scan = EmailScan(
            user_id=user_id,
            gmail_msg_id=msg_id,
            from_address=from_address,
            subject=subject,
            received_at=received_at,
            classification=result["classification"],
            extracted_data=result["extracted_data"],
            linked_job_id=linked_job_id,
            linked_application_id=linked_application_id,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        new_scans.append(scan)

    return new_scans
