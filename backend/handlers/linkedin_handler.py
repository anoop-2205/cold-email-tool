"""LinkedIn "Easy Apply" handler.

Easy Apply is a standardized multi-step modal (contact info -> resume ->
screening questions -> review -> submit), which makes it more predictable
than a full custom ATS form. IMPORTANT (Risk Matrix): never run this
against your main LinkedIn account -- use a dedicated scraping/apply
account so a block or ban doesn't touch your real profile.
"""
import random
import time

from playwright.sync_api import Page

from database import Job, Profile
from handlers.base_handler import BaseApplyHandler, answer_custom_question

EASY_APPLY_BUTTON = "button.jobs-apply-button"
NEXT_BUTTON = "button[aria-label='Continue to next step']"
REVIEW_BUTTON = "button[aria-label='Review your application']"
SUBMIT_BUTTON = "button[aria-label='Submit application']"
RESUME_UPLOAD_INPUT = "input[type='file'][name='file']"
FORM_QUESTION = ".fb-dash-form-element"


def _human_delay(lo: float = 1.0, hi: float = 3.0) -> None:
    time.sleep(random.uniform(lo, hi))


class LinkedInEasyApplyHandler(BaseApplyHandler):
    source = "linkedin"

    def open_job(self, page: Page, job: Job) -> None:
        page.goto(job.source_url)
        page.wait_for_load_state("networkidle")
        _human_delay()
        button = page.query_selector(EASY_APPLY_BUTTON)
        if button:
            button.click()
            _human_delay()

    def fill_form(self, page: Page, profile: Profile, tailored_resume_path: str, cover_letter_text: str) -> None:
        # Walk the modal's steps: upload resume where offered, answer any
        # screening questions, click Next until Review/Submit appears.
        for _ in range(8):  # hard cap so a stuck modal can't loop forever
            upload = page.query_selector(RESUME_UPLOAD_INPUT)
            if upload:
                upload.set_input_files(tailored_resume_path)
                _human_delay()

            for field in page.query_selector_all(FORM_QUESTION):
                label_el = field.query_selector("label")
                input_el = field.query_selector("input[type='text'], textarea")
                if label_el and input_el:
                    answer = answer_custom_question(profile, label_el.inner_text().strip())
                    input_el.fill(answer)
                    _human_delay(0.5, 1.5)

            if page.query_selector(REVIEW_BUTTON) or page.query_selector(SUBMIT_BUTTON):
                break
            next_btn = page.query_selector(NEXT_BUTTON)
            if not next_btn:
                break
            next_btn.click()
            _human_delay()

    def submit(self, page: Page, dry_run: bool) -> bool:
        submit_btn = page.query_selector(SUBMIT_BUTTON) or page.query_selector(REVIEW_BUTTON)
        if not submit_btn or dry_run:
            return False
        submit_btn.click()
        page.wait_for_load_state("networkidle")
        return True
