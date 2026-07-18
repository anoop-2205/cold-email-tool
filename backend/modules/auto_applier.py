"""Module E: Browser Automation Agent (orchestrator).

Picks the right platform handler for a job, drives it through Playwright
with a screenshot before/after for audit trail, and records the result as
an Application row. Defaults to dry-run (fill but never submit) per the
Risk Matrix mitigation for "Application submits wrong data" -- flip
DRY_RUN_APPLICATIONS=false in .env only once you trust the output.
"""
import uuid

from playwright.sync_api import sync_playwright
from sqlalchemy.orm import Session

from config import settings, SCREENSHOTS_DIR
from database import Application, Job, Profile, utcnow
from handlers.base_handler import BaseApplyHandler
from handlers.linkedin_handler import LinkedInEasyApplyHandler
from handlers.naukri_handler import NaukriApplyHandler
from modules.cover_letter import generate_cover_letter, render_cover_letter_pdf
from modules.resume_tailor import render_resume_pdf, tailor_profile_for_job

HANDLERS: dict[str, type[BaseApplyHandler]] = {
    "naukri": NaukriApplyHandler,
    "linkedin": LinkedInEasyApplyHandler,
}

MAX_RETRIES = 3


def apply_to_single_job(db: Session, profile: Profile, job: Job) -> Application:
    handler_cls = HANDLERS.get(job.source)
    if handler_cls is None:
        raise ValueError(f"No apply handler registered for source '{job.source}'")

    _enforce_daily_cap(db, job.user_id)

    tailored = tailor_profile_for_job(profile, job)
    resume_path = render_resume_pdf(profile, tailored, job)
    cover_text = generate_cover_letter(profile, job)
    cover_path = render_cover_letter_pdf(profile, job, cover_text)

    application = Application(
        job_id=job.id,
        tailored_resume_path=resume_path,
        cover_letter_path=cover_path,
        status="pending",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    handler = handler_cls()
    submitted, screenshot_path = _run_with_retries(handler, profile, job, resume_path, cover_text)

    application.screenshot_path = screenshot_path
    if submitted:
        application.status = "submitted"
        application.applied_at = utcnow()
        job.status = "applied"
    else:
        application.status = "dry_run" if settings.dry_run_applications else "failed"
    db.commit()
    db.refresh(application)
    return application


def _enforce_daily_cap(db: Session, user_id: int) -> None:
    from datetime import timedelta

    today_start = utcnow() - timedelta(days=1)
    count_today = (
        db.query(Application)
        .join(Job)
        .filter(Job.user_id == user_id, Application.applied_at.isnot(None), Application.applied_at >= today_start)
        .count()
    )
    if count_today >= settings.max_applications_per_day:
        raise RuntimeError(
            f"Daily application cap reached ({settings.max_applications_per_day}/day). "
            "Raise MAX_APPLICATIONS_PER_DAY in .env if this is intentional."
        )


def _run_with_retries(handler: BaseApplyHandler, profile: Profile, job: Job, resume_path: str, cover_text: str):
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return _run_once(handler, profile, job, resume_path, cover_text)
        except Exception as exc:  # noqa: BLE001 -- retry any automation failure
            last_error = exc
            _backoff_sleep(attempt)
    raise RuntimeError(f"Apply failed after {MAX_RETRIES} attempts: {last_error}") from last_error


def _backoff_sleep(attempt: int) -> None:
    import time

    time.sleep(2 ** attempt)


def _run_once(handler: BaseApplyHandler, profile: Profile, job: Job, resume_path: str, cover_text: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=settings.playwright_headless)
        context = browser.new_context()
        page = context.new_page()
        try:
            handler.open_job(page, job)
            before_path = SCREENSHOTS_DIR / f"before_{job.id}_{uuid.uuid4().hex[:8]}.png"
            page.screenshot(path=str(before_path))

            handler.fill_form(page, profile, resume_path, cover_text)

            after_path = SCREENSHOTS_DIR / f"after_{job.id}_{uuid.uuid4().hex[:8]}.png"
            page.screenshot(path=str(after_path))

            submitted = handler.submit(page, dry_run=settings.dry_run_applications)
            return submitted, str(after_path)
        finally:
            browser.close()
