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


def _build_raw_message(from_address: str, to_address: str, subject: str, body_text: str, attachment_path: str | None) -> str:
    msg = MIMEMultipart("mixed")
    msg["From"] = from_address
    msg["To"] = to_address
    msg["Subject"] = subject

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(body_text, "plain"))
    alt.attach(MIMEText(_markdown_to_html(body_text), "html"))
    msg.attach(alt)

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

    return base64.urlsafe_b64encode(msg.as_bytes()).decode()


def send_cold_email(
    db: Session,
    user_id: int,
    to_address: str,
    subject: str,
    body_text: str,
    attachment_path: str | None = None,
) -> str:
    """Sends as the candidate's connected Gmail. Returns the Gmail message id.
    Raises GmailAuthError (from email_scanner) if they haven't connected, or
    haven't re-consented to the gmail.send scope yet."""
    from database import User

    service = get_gmail_service_for_user(db, user_id)
    user = db.get(User, user_id)
    from_address = user.gmail_email or "me"

    raw = _build_raw_message(from_address, to_address, subject, body_text, attachment_path)
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
    return sent["id"]
