"""Module B: Job Discovery Engine.

Playwright-based scrapers for Naukri/LinkedIn/Indeed. Site DOMs change
often (see Risk Matrix in the plan), so every platform's CSS selectors
live in one SELECTORS dict below -- update them there, not in the scraping
logic, when a site's markup drifts. Verify current selectors in DevTools
before relying on this in production; treat what's here as a working
starting point, not a guarantee against the live sites.
"""
import hashlib
import random
import time
import uuid
from dataclasses import dataclass

from playwright.sync_api import sync_playwright, Page

from config import settings, SCREENSHOTS_DIR

# Update these when a platform changes its markup (Risk Matrix mitigation).
# Verified against the live site on 2026-07-08 -- Naukri now shows two
# type="submit" buttons on the login form ("Login" and "Use OTP to Login"),
# so login_submit must be specific enough to hit only the password-login one.
SELECTORS = {
    "naukri": {
        "login_url": "https://www.naukri.com/nlogin/login",
        "username_input": "#usernameField",
        "password_input": "#passwordField",
        "login_submit": 'button.blue-btn[type="submit"]',
        "logged_in_marker": ".view-profile-wrapper",
        "search_url": "https://www.naukri.com/{keywords}-jobs-in-{location}",
        "job_card": ".srp-jobtuple-wrapper",
        "title": ".title",
        "company": ".comp-name",
        "location": ".locWdth",
        "description": ".job-desc",
        "job_link": "a.title",
    },
    "linkedin": {
        "search_url": "https://www.linkedin.com/jobs/search/?keywords={keywords}&location={location}",
        "job_card": ".jobs-search__results-list li",
        "title": ".base-search-card__title",
        "company": ".base-search-card__subtitle",
        "location": ".job-search-card__location",
        "job_link": "a.base-card__full-link",
    },
}


@dataclass
class ScrapedJob:
    title: str
    company: str
    location: str
    description: str
    source: str
    source_url: str


@dataclass
class SearchQuery:
    keywords: str
    location: str = ""
    experience_years: int | None = None
    max_results: int = 50


def job_hash(title: str, company: str, location: str) -> str:
    key = f"{title.strip().lower()}|{company.strip().lower()}|{location.strip().lower()}"
    return hashlib.sha256(key.encode()).hexdigest()


def _human_delay(lo: float = 3.0, hi: float = 8.0) -> None:
    time.sleep(random.uniform(lo, hi))


class NaukriScraper:
    """Handles Naukri login + search + listing extraction (stealth mode: random
    delays, headful by default so the login/captcha flow is visible)."""

    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.selectors = SELECTORS["naukri"]

    def _login(self, page: Page) -> None:
        # "load"/"networkidle" are unreliable on Naukri -- it keeps
        # analytics/ad connections open indefinitely, so those wait
        # conditions can hang well past when the page is actually usable.
        # "domcontentloaded" + waiting for a real post-action element is
        # far more robust.
        page.goto(self.selectors["login_url"], wait_until="domcontentloaded", timeout=30000)
        _human_delay()
        page.wait_for_selector(self.selectors["username_input"], timeout=15000)
        page.fill(self.selectors["username_input"], self.username)
        page.fill(self.selectors["password_input"], self.password)
        _human_delay(1, 3)
        page.click(self.selectors["login_submit"])
        # Login redirects to the homepage; wait for a logged-in-only element
        # rather than a network-quiescence condition that may never fire.
        page.wait_for_selector(self.selectors["logged_in_marker"], timeout=20000)

    def search(self, query: SearchQuery) -> list[ScrapedJob]:
        results: list[ScrapedJob] = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=settings.playwright_headless)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1366, "height": 768},
            )
            page = context.new_page()
            try:
                self._login(page)
                url = self.selectors["search_url"].format(
                    keywords=query.keywords.replace(" ", "-"),
                    location=query.location.replace(" ", "-") or "india",
                )
                # The results page is client-rendered (job cards populate
                # after an XHR fetch), so wait for that element rather than
                # the "load" event -- domcontentloaded + a generous
                # selector timeout is what actually matches how the page behaves.
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_selector(self.selectors["job_card"], timeout=20000)

                cards = page.query_selector_all(self.selectors["job_card"])
                for card in cards[: query.max_results]:
                    title_el = card.query_selector(self.selectors["title"])
                    company_el = card.query_selector(self.selectors["company"])
                    location_el = card.query_selector(self.selectors["location"])
                    link_el = card.query_selector(self.selectors["job_link"])
                    if not title_el or not company_el:
                        continue
                    results.append(
                        ScrapedJob(
                            title=title_el.inner_text().strip(),
                            company=company_el.inner_text().strip(),
                            location=location_el.inner_text().strip() if location_el else query.location,
                            description=title_el.get_attribute("title") or "",
                            source="naukri",
                            source_url=link_el.get_attribute("href") if link_el else "",
                        )
                    )
                    _human_delay(0.5, 1.5)
            except Exception:
                # Save a screenshot so a scraper failure is diagnosable from
                # the dashboard/logs alone -- no need to reproduce it live.
                try:
                    page.screenshot(path=str(SCREENSHOTS_DIR / f"naukri_scrape_error_{uuid.uuid4().hex[:8]}.png"))
                except Exception:  # noqa: BLE001 -- screenshotting the failure must never mask the real error
                    pass
                raise
            finally:
                browser.close()
        return results


def dedupe_new_jobs(db, user_id: int, scraped: list[ScrapedJob]) -> int:
    """Insert scraped jobs into this user's feed that aren't already there
    (by hash, scoped per-user -- the same listing can appear in multiple
    candidates' feeds). Returns count inserted.

    Naukri's own search results can list the same posting more than once
    (sponsored/duplicate listings), so this also dedupes within the batch
    itself -- checking the DB alone isn't enough, since two identical items
    in `scraped` would both pass a per-item "does this exist yet?" query
    before either is committed, tripping the (user_id, hash) unique
    constraint on the second insert."""
    from database import Job

    seen_in_batch: set[str] = set()
    inserted = 0
    for item in scraped:
        h = job_hash(item.title, item.company, item.location)
        if h in seen_in_batch:
            continue
        seen_in_batch.add(h)
        if db.query(Job).filter_by(hash=h, user_id=user_id).first():
            continue
        db.add(
            Job(
                user_id=user_id,
                title=item.title,
                company=item.company,
                location=item.location,
                description=item.description,
                source=item.source,
                source_url=item.source_url,
                hash=h,
            )
        )
        inserted += 1
    db.commit()
    return inserted
