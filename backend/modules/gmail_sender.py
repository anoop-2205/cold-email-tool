"""Sends email via the Gmail API as the candidate's own connected account
(gmail.send scope) -- cold emails to recruiters, with the tailored resume
attached. Reuses email_scanner.get_gmail_service_for_user so there's one
place that turns a User row into an authenticated Gmail client.
"""
import base64
import html
import mimetypes
import re
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from modules.email_scanner import GmailAuthError, get_gmail_service_for_user


def _markdown_to_html(body_text: str) -> str:
    """Cold email templates use **bold** for emphasis; render it properly
    instead of sending it to the recipient's inbox as literal asterisks."""
    escaped = html.escape(body_text)
    bolded = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    linebreaked = bolded.replace("\n", "<br />")
    return (
        "<div style=\"font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; "
        "color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 10px 0;\">"
        f"{linebreaked}</div>"
    )


def _build_raw_message(
    from_address: str, to_address: str, subject: str, body_text: str, attachment_path: str | None
) -> tuple[str, bool]:
    """Returns (raw_message, resume_actually_attached). The caller's
    attachment_path is just what's on file for the candidate's profile --
    verify it still exists on disk before claiming it was attached, rather
    than silently sending without it while callers report success."""
    msg = MIMEMultipart("mixed")
    msg["From"] = from_address
    msg["To"] = to_address
    msg["Subject"] = subject

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(body_text, "plain"))
    alt.attach(MIMEText(_markdown_to_html(body_text), "html"))
    msg.attach(alt)

    attached = False
    if attachment_path:
        path = Path(attachment_path)
        if path.exists():
            content_type, _ = mimetypes.guess_type(path.name)
            content_type = content_type or "application/pdf"
            maintype, subtype = content_type.split("/", 1)
            with path.open("rb") as f:
                part = MIMEApplication(f.read(), _subtype=subtype)
            part.add_header("Content-Disposition", "attachment", filename=path.name)
            msg.attach(part)
            attached = True

    return base64.urlsafe_b64encode(msg.as_bytes()).decode(), attached


def send_cold_email(
    db: Session,
    user_id: int,
    to_address: str,
    subject: str,
    body_text: str,
    attachment_path: str | None = None,
) -> tuple[str, bool]:
    """Sends as the candidate's connected Gmail. Returns (gmail_message_id,
    resume_actually_attached) -- the latter is False if attachment_path was
    given but the file no longer exists on disk, so callers can record what
    actually happened rather than what was merely requested.
    Raises GmailAuthError (from email_scanner) if they haven't connected, or
    haven't re-consented to the gmail.send scope yet."""
    from database import User

    service = get_gmail_service_for_user(db, user_id)
    user = db.get(User, user_id)
    from_address = user.gmail_email or "me"

    raw, resume_attached = _build_raw_message(from_address, to_address, subject, body_text, attachment_path)
    try:
        sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    except HttpError as exc:
        if exc.resp.status in (401, 403):
            # Most likely: they connected before gmail.send was added to our
            # scope request and only ever granted gmail.readonly.
            raise GmailAuthError(
                "Gmail needs to be reconnected to allow sending (this account was connected before send "
                "permission was added). Disconnect and reconnect Gmail on the Inbox page."
            ) from exc
        raise
    return sent["id"], resume_attached
