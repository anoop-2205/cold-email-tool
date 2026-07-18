"""FastAPI app entry point.

Mounts every router, initializes the SQLite DB, and starts the
APScheduler background jobs (job scraper every N hours, email scan every
15 minutes, daily summary notification) per the plan's Section 2/5 design.
"""
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import SessionLocal, init_db
from routers import admin, agent, analytics, applications, auth, cold_email, email_intel, gmail, jobs, naukri, outreach, profile
from routers import settings as settings_router

scheduler = BackgroundScheduler()


def _write_gmail_credentials_from_env() -> None:
    """Container hosts can't have a file hand-copied in before first boot --
    if GMAIL_CREDENTIALS_JSON is set, write it out so the rest of the app
    can keep just reading gmail_credentials_path like normal. No-op locally
    where the file is just dropped into backend/config/ directly."""
    if settings.gmail_credentials_json and not settings.gmail_credentials_path.exists():
        settings.gmail_credentials_path.write_text(settings.gmail_credentials_json)


def _seed_bootstrap_admin() -> None:
    """Create the first admin account from APP_USERNAME/APP_PASSWORD_HASH if no
    admin exists yet. Runs once; after that, admins are just rows in the users
    table and this is a no-op. Candidates always come in through /register."""
    from database import User

    if not settings.app_password_hash:
        return
    db = SessionLocal()
    try:
        if db.query(User).filter_by(role="admin").first():
            return
        db.add(User(email=settings.app_username, password_hash=settings.app_password_hash, full_name="Admin", role="admin"))
        db.commit()
    finally:
        db.close()


def _scheduled_scraper_and_matcher() -> None:
    """Runs the scraper + matcher for every candidate who has a profile --
    each user's job feed AND Naukri login are their own, per the multi-user
    data model. Candidates who haven't connected Naukri just get matching
    run on whatever's already in their feed (e.g. from email alerts)."""
    from database import Profile, Setting, User
    from modules.crypto import decrypt
    from modules.job_matcher import score_pending_jobs
    from modules.job_scraper import NaukriScraper, SearchQuery, dedupe_new_jobs

    db = SessionLocal()
    try:
        candidates = db.query(User).join(Profile).filter(User.role == "candidate").all()
        for user in candidates:
            if user.naukri_username and user.naukri_password_encrypted:
                setting = db.query(Setting).filter_by(key=f"search_queries:{user.id}").first()
                queries = (setting.value if setting else None) or [{"keywords": "software engineer", "location": "india"}]
                scraper = NaukriScraper(user.naukri_username, decrypt(user.naukri_password_encrypted))
                for q in queries:
                    scraped_jobs = scraper.search(SearchQuery(**q))
                    dedupe_new_jobs(db, user.id, scraped_jobs)

            score_pending_jobs(db, user.profile, user.id)
    finally:
        db.close()


def _scheduled_email_scan() -> None:
    """Scans every user's own connected Gmail (each user's inbox, not a
    shared one) -- users who haven't connected Gmail are skipped."""
    from database import User
    from modules.email_scanner import GmailAuthError, scan_inbox

    db = SessionLocal()
    try:
        connected_users = db.query(User).filter(User.gmail_token_json.isnot(None)).all()
        for user in connected_users:
            try:
                scan_inbox(db, user.id)
            except GmailAuthError:
                continue  # this user's token expired/was revoked; skip until they reconnect
    finally:
        db.close()


def _scheduled_daily_summary() -> None:
    from modules.notifier import daily_summary

    db = SessionLocal()
    try:
        daily_summary(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    _write_gmail_credentials_from_env()
    _seed_bootstrap_admin()
    scheduler.add_job(_scheduled_scraper_and_matcher, "interval", hours=settings.scraper_interval_hours, id="scraper_matcher")
    scheduler.add_job(_scheduled_email_scan, "interval", minutes=settings.email_scan_interval_minutes, id="email_scan")
    scheduler.add_job(_scheduled_daily_summary, "cron", hour=8, id="daily_summary")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="AutoApply Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(agent.router)
app.include_router(analytics.router)
app.include_router(email_intel.router)
app.include_router(settings_router.router)
app.include_router(admin.router)
app.include_router(gmail.router)
app.include_router(outreach.router)
app.include_router(cold_email.router)
app.include_router(naukri.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
