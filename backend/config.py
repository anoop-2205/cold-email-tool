"""Central settings for the AutoApply Agent backend.

Loaded once as `settings` and imported everywhere else. All values come
from environment variables (see .env.example) so the same code runs
locally or on any host without edits.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent
# DATA_DIR override lets a mounted persistent volume (e.g. Railway) hold the
# SQLite DB + uploaded resumes/screenshots, so they survive redeploys --
# without it, everything on the container filesystem resets on every deploy.
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data"))
RESUMES_DIR = DATA_DIR / "resumes"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"
CONFIG_DIR = Path(os.environ.get("CONFIG_DIR", BASE_DIR / "config"))

for _dir in (DATA_DIR, RESUMES_DIR, SCREENSHOTS_DIR, CONFIG_DIR):
    _dir.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR.parent / ".env", extra="ignore")

    # --- Environment ---------------------------------------------------------
    # "development" (default, local) or "production". Gates dev-only escape
    # hatches -- e.g. forgot-password returning the reset link directly in the
    # API response when SMTP isn't configured/reachable. Set explicitly via
    # env var on any real deployment; never infer it from a vendor-specific var.
    environment: str = "development"

    # --- LLM provider ---------------------------------------------------
    # "claude" or "ollama". Every module that calls an LLM goes through
    # modules/llm.py so this is the only place the provider is chosen.
    llm_provider: str = "claude"
    anthropic_api_key: str = ""
    claude_model: str = "claude-haiku-4-5"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"

    # --- Database ---------------------------------------------------------
    database_url: str = f"sqlite:///{DATA_DIR / 'autoapply.db'}"

    # --- Auth (multi-user) -----------------------------------------------
    jwt_secret: str = "change-me-in-.env"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24 * 7
    # Bootstrap admin: seeded into the users table once, on first startup,
    # if no admin account exists yet. Candidates sign up via /api/auth/register.
    app_username: str = "admin"
    app_password_hash: str = ""  # generated via passlib, see README

    # --- Gmail / Email Intelligence (per-user OAuth) ------------------------
    # credentials.json is the shared OAuth CLIENT (Web application type, with
    # GMAIL_REDIRECT_URI as an authorized redirect URI) -- every user's Gmail
    # connection goes through it, but each user's resulting token is stored
    # separately (User.gmail_token_json), not in a shared token file.
    gmail_credentials_path: Path = CONFIG_DIR / "credentials.json"
    # On a container host there's no way to hand-copy a file onto the
    # filesystem before first boot -- paste the credentials.json contents
    # into this env var instead, and main.py writes it to
    # gmail_credentials_path on startup. Local dev can ignore this and just
    # drop the file in backend/config/ directly.
    gmail_credentials_json: str = ""
    gmail_redirect_uri: str = "http://localhost:8000/api/gmail/callback"
    frontend_url: str = "http://localhost:3000"
    email_scan_interval_minutes: int = 15

    # --- CORS ---------------------------------------------------------------
    # Comma-separated list of origins allowed to call this API (the deployed
    # frontend's URL(s)). Defaults to local dev only.
    cors_origins: str = "http://localhost:3000"

    # --- Job discovery / matching ------------------------------------------
    scraper_interval_hours: int = 6
    auto_reject_below: int = 40
    auto_approve_above: int = 80
    max_applications_per_day: int = 15
    # Naukri credentials are per-candidate now (User.naukri_username /
    # naukri_password_encrypted, set via Settings in the dashboard), not a
    # single shared account here.

    # --- Notifications -------------------------------------------------------
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    notify_email_to: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # --- Browser automation ---------------------------------------------------
    playwright_headless: bool = False
    dry_run_applications: bool = True  # fill forms but don't submit until disabled

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
