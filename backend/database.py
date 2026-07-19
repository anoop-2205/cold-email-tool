"""SQLAlchemy models + engine/session setup, per the plan's Section 8 schema.

SQLite by default (single file, zero setup). Swap DATABASE_URL in .env to a
Postgres DSN later without touching this file.
"""
from datetime import datetime, timezone

from sqlalchemy import create_engine, Column, Integer, String, Text, JSON, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

from config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def utcnow() -> datetime:
    """Naive UTC datetime -- SQLAlchemy's SQLite DateTime type strips tzinfo on
    round-trip, so storing tz-aware values here would make every later
    comparison against a tz-aware "now" raise TypeError. Keep everything
    that touches the DB naive-UTC for consistency."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, default="")
    role = Column(String, default="candidate")  # "admin" or "candidate"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    last_login_at = Column(DateTime, nullable=True)

    # Per-user Gmail connection (OAuth2 credentials, JSON-serialized via
    # google.oauth2.credentials.Credentials.to_json()). Null == not connected.
    gmail_token_json = Column(Text, nullable=True)
    gmail_email = Column(String, nullable=True)

    # Per-user Naukri login (no OAuth on Naukri's side, so this is the
    # actual account password -- encrypted at rest via modules/crypto.py,
    # never returned by any API response). Null == not connected.
    naukri_username = Column(String, nullable=True)
    naukri_password_encrypted = Column(Text, nullable=True)

    profile = relationship("Profile", back_populates="user", uselist=False)
    jobs = relationship("Job", back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    full_name = Column(String, default="")
    email = Column(String, default="")
    phone = Column(String, default="")
    location = Column(String, default="")
    summary = Column(Text, default="")
    skills = Column(JSON, default=list)
    experience = Column(JSON, default=list)
    education = Column(JSON, default=list)
    projects = Column(JSON, default=list)
    portfolio_url = Column(String, default="")
    github_url = Column(String, default="")
    linkedin_url = Column(String, default="")
    resume_pdf_path = Column(String, default="")
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="profile")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("user_id", "hash", name="uq_job_user_hash"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    location = Column(String, default="")
    description = Column(Text, default="")
    source = Column(String, default="manual")  # naukri / linkedin / indeed / email-alert
    source_url = Column(String, default="")
    match_score = Column(Integer, nullable=True)
    match_reasons = Column(JSON, default=list)
    status = Column(String, default="new")  # new/approved/rejected/applied/interviewing/offered
    hash = Column(String, index=True, nullable=False)
    discovered_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="jobs")
    applications = relationship("Application", back_populates="job")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    tailored_resume_path = Column(String, default="")
    cover_letter_path = Column(String, default="")
    applied_at = Column(DateTime, nullable=True)
    screenshot_path = Column(String, default="")
    status = Column(String, default="submitted")  # submitted/acknowledged/interview/rejected/offered
    notes = Column(Text, default="")
    response_date = Column(DateTime, nullable=True)
    follow_up_date = Column(DateTime, nullable=True)

    job = relationship("Job", back_populates="applications")


class EmailScan(Base):
    __tablename__ = "email_scans"
    __table_args__ = (UniqueConstraint("user_id", "gmail_msg_id", name="uq_emailscan_user_msg"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    gmail_msg_id = Column(String, index=True, nullable=False)
    from_address = Column(String, default="")
    subject = Column(String, default="")
    received_at = Column(DateTime, nullable=True)
    classification = Column(String, default="IRRELEVANT")
    extracted_data = Column(JSON, default=dict)
    linked_job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    linked_application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    scanned_at = Column(DateTime, default=utcnow)


class Outreach(Base):
    """A cold email sent (via the candidate's own connected Gmail, gmail.send
    scope) to a recruiter/HR contact -- either tied to a job from the
    candidate's feed or freeform for a company they haven't seen a listing
    for yet."""

    __tablename__ = "outreach"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    recruiter_email = Column(String, nullable=False)
    company = Column(String, default="")
    role_title = Column(String, default="")
    subject = Column(String, default="")
    body = Column(Text, default="")
    resume_attached = Column(Boolean, default=False)
    gmail_message_id = Column(String, default="")
    status = Column(String, default="sent")  # sent / failed
    sent_at = Column(DateTime, default=utcnow)

    job = relationship("Job")


class ColdEmail(Base):
    """A custom cold email sent to one or more recipients at once, via the
    candidate's own connected Gmail, using a canned template -- not tied to
    a job listing and not AI-drafted (see Outreach for that flow)."""

    __tablename__ = "cold_emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recruiter_email = Column(String, nullable=False)
    template = Column(String, default="")
    subject = Column(String, default="")
    body = Column(Text, default="")
    resume_attached = Column(Boolean, default=False)
    gmail_message_id = Column(String, default="")
    status = Column(String, default="sent")  # sent / failed
    sent_at = Column(DateTime, default=utcnow)


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(JSON, default=dict)


def _migrate_add_missing_columns() -> None:
    """create_all() only creates missing tables, never adds columns to ones
    that already exist -- there's no Alembic here, so handle the common case
    (a new nullable/defaulted column on an existing table) by hand. ADD
    COLUMN with a simple type + default is valid on both SQLite and Postgres."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    for table in Base.metadata.tables.values():
        if table.name not in inspector.get_table_names():
            continue
        existing = {col["name"] for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing:
                continue
            col_type = column.type.compile(engine.dialect)
            default = "''" if isinstance(column.type, String) else "NULL"
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type} DEFAULT {default}"))


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_add_missing_columns()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
