"""Module C: AI Job Matcher.

Scores a job 0-100 against the user's profile with structured reasons.
Jobs already scored are skipped by callers (see routers/jobs.py) so a
scraper run never re-spends tokens on the same listing.
"""
from database import Job, Profile
from modules.llm import complete_json

SYSTEM_PROMPT = """You are a job-fit scoring engine for a job seeker. Given a candidate profile and a
job description, score the match from 0 to 100 considering: skills overlap, experience level fit,
domain/industry fit, and location fit. Return JSON ONLY:
{
  "score": integer 0-100,
  "reasons": [string, ...]   // 2-5 short bullet reasons for the score, most important first
}
Be honest and specific -- do not inflate scores. A generic/unrelated role should score below 30."""


def _profile_summary(profile: Profile) -> str:
    return (
        f"Summary: {profile.summary}\n"
        f"Skills: {', '.join(profile.skills or [])}\n"
        f"Experience: {profile.experience}\n"
        f"Education: {profile.education}\n"
        f"Projects: {profile.projects}\n"
        f"Location: {profile.location}"
    )


def score_job(profile: Profile, job: Job) -> dict:
    """Return {"score": int, "reasons": [str, ...]} for one job."""
    user_prompt = (
        f"CANDIDATE PROFILE:\n{_profile_summary(profile)}\n\n"
        f"JOB:\nTitle: {job.title}\nCompany: {job.company}\nLocation: {job.location}\n"
        f"Description:\n{job.description}"
    )
    result = complete_json(SYSTEM_PROMPT, user_prompt, max_tokens=500)
    score = max(0, min(100, int(result.get("score", 0))))
    reasons = result.get("reasons", [])
    return {"score": score, "reasons": reasons}


def status_for_score(score: int, auto_reject_below: int, auto_approve_above: int) -> str:
    if score < auto_reject_below:
        return "rejected"
    if score >= auto_approve_above:
        return "approved"
    return "new"


def _user_thresholds(db, user_id: int) -> tuple[int, int]:
    """Per-user threshold overrides set via the Settings page, falling back
    to the .env defaults when a user hasn't configured their own."""
    from config import settings
    from database import Setting

    reject_row = db.query(Setting).filter_by(key=f"auto_reject_threshold:{user_id}").first()
    approve_row = db.query(Setting).filter_by(key=f"auto_approve_threshold:{user_id}").first()
    auto_reject_below = reject_row.value if reject_row else settings.auto_reject_below
    auto_approve_above = approve_row.value if approve_row else settings.auto_approve_above
    return auto_reject_below, auto_approve_above


def score_pending_jobs(db, profile: Profile, user_id: int, limit: int = 100) -> list[Job]:
    """Score every job in this user's feed that hasn't been scored yet
    (match_score is NULL), up to `limit`."""
    auto_reject_below, auto_approve_above = _user_thresholds(db, user_id)

    pending = db.query(Job).filter(Job.match_score.is_(None), Job.user_id == user_id).limit(limit).all()
    scored = []
    for job in pending:
        result = score_job(profile, job)
        job.match_score = result["score"]
        job.match_reasons = result["reasons"]
        job.status = status_for_score(result["score"], auto_reject_below, auto_approve_above)
        scored.append(job)
    db.commit()
    return scored
