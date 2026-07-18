"""Module D: Resume Tailor.

Asks the LLM to rewrite the summary and reorder skills/projects/experience
bullets so they lead with what matches the JD, then renders an ATS-friendly
PDF with ReportLab (single column, plain text, no tables/graphics that
trip up parsers).
"""
import uuid

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem

from config import RESUMES_DIR
from database import Job, Profile
from modules.llm import complete_json

SYSTEM_PROMPT = """You are a resume tailoring assistant. Given a candidate's profile and a target job
description, rewrite the professional summary (3-4 sentences) to emphasize the most relevant
experience for THIS job, and reorder the skills list so the most JD-relevant skills come first.
Do not fabricate experience or skills that aren't in the original profile.
Return JSON ONLY:
{"summary": string, "skills": [string, ...] }"""


def tailor_profile_for_job(profile: Profile, job: Job) -> dict:
    user_prompt = (
        f"CANDIDATE SUMMARY: {profile.summary}\n"
        f"CANDIDATE SKILLS: {', '.join(profile.skills or [])}\n\n"
        f"JOB TITLE: {job.title}\nCOMPANY: {job.company}\nDESCRIPTION:\n{job.description}"
    )
    result = complete_json(SYSTEM_PROMPT, user_prompt, max_tokens=800)
    return {
        "summary": result.get("summary") or profile.summary,
        "skills": result.get("skills") or (profile.skills or []),
    }


def render_resume_pdf(profile: Profile, tailored: dict, job: Job) -> str:
    """Render an ATS-friendly resume PDF for this job application. Returns the file path."""
    filename = f"resume_{profile.id}_{job.id}_{uuid.uuid4().hex[:8]}.pdf"
    path = RESUMES_DIR / filename

    styles = getSampleStyleSheet()
    name_style = ParagraphStyle("Name", parent=styles["Title"], fontSize=18, spaceAfter=2)
    contact_style = ParagraphStyle("Contact", parent=styles["Normal"], fontSize=9, textColor="#444444")
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"], spaceBefore=12, spaceAfter=4)
    body_style = styles["Normal"]

    doc = SimpleDocTemplate(str(path), pagesize=LETTER, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    story = [
        Paragraph(profile.full_name or "Candidate", name_style),
        Paragraph(f"{profile.email} | {profile.phone} | {profile.location}", contact_style),
        Spacer(1, 10),
        Paragraph("Summary", heading_style),
        Paragraph(tailored["summary"], body_style),
        Paragraph("Skills", heading_style),
        Paragraph(", ".join(tailored["skills"]), body_style),
    ]

    if profile.experience:
        story.append(Paragraph("Experience", heading_style))
        for exp in profile.experience:
            story.append(Paragraph(f"<b>{exp.get('role', '')}</b> — {exp.get('company', '')} ({exp.get('duration', '')})", body_style))
            bullets = exp.get("bullets") or []
            if bullets:
                story.append(ListFlowable([ListItem(Paragraph(b, body_style)) for b in bullets], bulletType="bullet"))
            story.append(Spacer(1, 6))

    if profile.projects:
        story.append(Paragraph("Projects", heading_style))
        for proj in profile.projects:
            tech = ", ".join(proj.get("tech") or [])
            story.append(Paragraph(f"<b>{proj.get('name', '')}</b> ({tech})", body_style))
            story.append(Paragraph(proj.get("description", ""), body_style))
            story.append(Spacer(1, 6))

    if profile.education:
        story.append(Paragraph("Education", heading_style))
        for edu in profile.education:
            story.append(Paragraph(f"{edu.get('degree', '')} — {edu.get('institution', '')} ({edu.get('year', '')})", body_style))

    doc.build(story)
    return str(path)
