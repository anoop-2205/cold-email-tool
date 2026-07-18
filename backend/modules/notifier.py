"""Email (smtplib) + Telegram notifications.

Both are best-effort: a missing/incomplete config (no SMTP creds, no bot
token) just skips that channel silently rather than breaking the caller,
since notifications should never take down a scraper/matcher run.
"""
import smtplib
from email.mime.text import MIMEText

import httpx

from config import settings


def smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def send_email_to(to_address: str, subject: str, body: str) -> bool:
    """Send to an arbitrary recipient (password resets, etc). Returns False
    -- rather than raising -- when SMTP isn't configured or unreachable, so
    callers can fall back to a dev-mode alternative (e.g. returning the link
    directly). A bounded connect timeout is essential here: many hosts
    (Railway included) block outbound SMTP ports, and smtplib has no timeout
    by default -- without one, a blocked port hangs the request indefinitely
    instead of failing over to the fallback."""
    if not (smtp_configured() and to_address):
        return False
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.smtp_user
    msg["To"] = to_address
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True
    except (smtplib.SMTPException, OSError):
        return False


def send_email(subject: str, body: str) -> bool:
    """Sends to the fixed admin notification address (daily summaries etc)."""
    return send_email_to(settings.notify_email_to, subject, body)


def send_telegram(text: str) -> bool:
    if not (settings.telegram_bot_token and settings.telegram_chat_id):
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    resp = httpx.post(url, json={"chat_id": settings.telegram_chat_id, "text": text}, timeout=10)
    resp.raise_for_status()
    return True


def notify(subject: str, body: str) -> None:
    """Fire-and-forget on both channels; failures are swallowed so a bad
    Telegram token doesn't stop email (or vice versa)."""
    for send in (lambda: send_email(subject, body), lambda: send_telegram(f"{subject}\n\n{body}")):
        try:
            send()
        except Exception:  # noqa: BLE001 -- notification failures must never bubble up
            continue


def daily_summary(db) -> None:
    from datetime import timedelta

    from database import Application, EmailScan, Job, utcnow

    since = utcnow() - timedelta(days=1)
    new_jobs = db.query(Job).filter(Job.discovered_at >= since).count()
    applied = db.query(Application).filter(Application.applied_at >= since).count()
    responses = db.query(EmailScan).filter(EmailScan.scanned_at >= since, EmailScan.classification != "IRRELEVANT").count()

    body = (
        f"New jobs discovered: {new_jobs}\n"
        f"Applications submitted: {applied}\n"
        f"Email responses detected: {responses}"
    )
    notify("AutoApply Agent — Daily Summary", body)
