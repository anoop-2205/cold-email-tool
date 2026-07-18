"""Naukri "1-click apply" / form-apply handler.

Naukri usually shows an in-page apply button; some listings redirect to a
company ATS instead, in which case we fall back to generic field detection.
Selectors live in modules/job_scraper.SELECTORS["naukri"] plus the small
apply-specific ones below -- update here first when Naukri's markup drifts.
"""
import random
import time

from playwright.sync_api import Page

from database import Job, Profile
from handlers.base_handler import BaseApplyHandler, answer_custom_question

APPLY_BUTTON = "#apply-button, .apply-button, button:has-text('Apply')"
RESUME_UPLOAD_INPUT = "input[type='file']"
CUSTOM_QUESTION_BLOCK = ".chatbot_MessageContainer, .ssrc__chat-msg-container"


def _human_delay(lo: float = 1.0, hi: float = 3.0) -> None:
    time.sleep(random.uniform(lo, hi))


class NaukriApplyHandler(BaseApplyHandler):
    source = "naukri"

    def open_job(self, page: Page, job: Job) -> None:
        page.goto(job.source_url)
        page.wait_for_load_state("networkidle")
        _human_delay()

    def fill_form(self, page: Page, profile: Profile, tailored_resume_path: str, cover_letter_text: str) -> None:
        upload = page.query_selector(RESUME_UPLOAD_INPUT)
        if upload:
            upload.set_input_files(tailored_resume_path)
            _human_delay()

        # Naukri often runs a chat-style Q&A for screening questions instead of a
        # static form. Answer each visible question as it appears.
        for question_el in page.query_selector_all(CUSTOM_QUESTION_BLOCK):
            question_text = question_el.inner_text().strip()
            if not question_text:
                continue
            answer = answer_custom_question(profile, question_text)
            answer_input = page.query_selector("textarea, input[type='text']")
            if answer_input:
                answer_input.fill(answer)
                _human_delay(0.5, 1.5)

    def submit(self, page: Page, dry_run: bool) -> bool:
        button = page.query_selector(APPLY_BUTTON)
        if not button:
            return False
        if dry_run:
            return False
        button.click()
        page.wait_for_load_state("networkidle")
        return True
