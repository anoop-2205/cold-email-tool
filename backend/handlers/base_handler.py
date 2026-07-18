"""Abstract interface every platform-specific apply handler implements.

auto_applier.py picks a handler by `Job.source` and calls these three
methods in order. Keeping the interface tiny means adding Indeed/Wellfound
later is "write one new handler," not "touch the applier."
"""
from abc import ABC, abstractmethod

from playwright.sync_api import Page

from database import Job, Profile
from modules.llm import complete_text

QUESTION_SYSTEM_PROMPT = """You are filling out a job application form on behalf of a candidate.
Answer the screening question briefly and truthfully using ONLY the candidate profile given.
If the question asks for a number (years of experience, expected salary, notice period) and the
profile doesn't state it, give a reasonable estimate consistent with the profile. Return plain text
only -- just the answer, no preamble."""


def answer_custom_question(profile: Profile, question: str) -> str:
    """Ask the LLM to answer a free-text screening question from the profile."""
    context = (
        f"Name: {profile.full_name}\nSummary: {profile.summary}\nSkills: {', '.join(profile.skills or [])}\n"
        f"Experience: {profile.experience}\nLocation: {profile.location}"
    )
    return complete_text(QUESTION_SYSTEM_PROMPT, f"PROFILE:\n{context}\n\nQUESTION: {question}", max_tokens=200).strip()


class BaseApplyHandler(ABC):
    source: str = "base"

    @abstractmethod
    def open_job(self, page: Page, job: Job) -> None:
        """Navigate to the job's apply page and get it ready for filling."""

    @abstractmethod
    def fill_form(self, page: Page, profile: Profile, tailored_resume_path: str, cover_letter_text: str) -> None:
        """Fill every detected field: text inputs, dropdowns, checkboxes, resume upload.
        For fields that don't map to a known profile attribute, ask the LLM to answer
        from the profile context (custom screening questions)."""

    @abstractmethod
    def submit(self, page: Page, dry_run: bool) -> bool:
        """Click submit unless dry_run is True. Returns True if actually submitted."""
