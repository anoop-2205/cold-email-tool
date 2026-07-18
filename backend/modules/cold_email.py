"""AI-drafted cold outreach emails to recruiters/HRs, sent via the
candidate's own connected Gmail (modules/gmail_sender.py). Distinct from
cover_letter.py: this is unsolicited outreach, not a formal application
attachment -- shorter, punchier, with one specific low-friction ask.
"""
from database import Profile
from modules.llm import complete_json

SYSTEM_PROMPT = """You write short, effective cold outreach emails from a job seeker to a recruiter or hiring
manager. Return JSON ONLY:
{"subject": string, "body": string}

Rules for the body:
- Under 150 words, plain text, no markdown
- Open with something specific and true about the candidate (not "I hope this finds you well")
- Reference the company/role by name
- One clear, low-friction ask at the end (e.g. "open to a quick chat this week?")
- No generic filler, no placeholders like [Company Name]
- Sign off with just the candidate's first name -- full contact details are in the resume attachment

Rules for the subject: under 60 characters, specific, not clickbait ("Question about the Backend Engineer
role at Acme" not "Exciting opportunity!!")."""


def draft_cold_email(profile: Profile, company: str, role_title: str, job_description: str = "") -> dict:
    context = (
        f"CANDIDATE: {profile.full_name}\nSummary: {profile.summary}\nSkills: {', '.join(profile.skills or [])}\n"
        f"Experience: {profile.experience}\n\n"
        f"TARGET: {role_title or 'a relevant role'} at {company}"
    )
    if job_description:
        context += f"\nJob description:\n{job_description}"

    result = complete_json(SYSTEM_PROMPT, context, max_tokens=500)
    return {
        "subject": result.get("subject") or f"Interest in {role_title or 'opportunities'} at {company}",
        "body": result.get("body", ""),
    }
