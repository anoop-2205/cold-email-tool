"""Module D: Cover Letter Generator.

Generates a short, company-specific cover letter and renders it as a
simple one-page PDF alongside the tailored resume.
"""
import uuid

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

from config import RESUMES_DIR
from database import Job, Profile
from modules.llm import complete_text

SYSTEM_PROMPT = """You write concise, specific cover letters for job applications. 3 short paragraphs,
max 250 words total. Reference the company and role by name, connect 1-2 concrete points from the
candidate's background to the job's actual requirements, no generic filler ("I am writing to express
my interest..."). Plain text only, no markdown, no placeholders like [Company Name]."""


def generate_cover_letter(profile: Profile, job: Job) -> str:
    user_prompt = (
        f"CANDIDATE: {profile.full_name}\nSummary: {profile.summary}\nSkills: {', '.join(profile.skills or [])}\n"
        f"Experience: {profile.experience}\n\n"
        f"JOB: {job.title} at {job.company}\nDescription:\n{job.description}"
    )
    return complete_text(SYSTEM_PROMPT, user_prompt, max_tokens=600).strip()


def render_cover_letter_pdf(profile: Profile, job: Job, letter_text: str) -> str:
    filename = f"cover_{profile.id}_{job.id}_{uuid.uuid4().hex[:8]}.pdf"
    path = RESUMES_DIR / filename

    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(path), pagesize=LETTER, topMargin=0.8 * inch, bottomMargin=0.8 * inch)

    story = [Paragraph(profile.full_name or "", styles["Heading2"]), Spacer(1, 4)]
    story.append(Paragraph(f"{profile.email} | {profile.phone}", styles["Normal"]))
    story.append(Spacer(1, 16))
    story.append(Paragraph(f"Re: Application for {job.title} at {job.company}", styles["Heading3"]))
    story.append(Spacer(1, 10))
    for para in letter_text.split("\n\n"):
        if para.strip():
            story.append(Paragraph(para.strip().replace("\n", "<br/>"), styles["Normal"]))
            story.append(Spacer(1, 10))

    doc.build(story)
    return str(path)
