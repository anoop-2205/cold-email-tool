# AutoApply Agent

A personal, self-hosted AI agent that discovers, matches, tailors, and (optionally) auto-applies to jobs on your
behalf — plus an Email Intelligence layer that scans your Gmail locally for recruiter replies and job alerts.

Two parts, run separately:

- **`backend/`** — Python FastAPI. Resume parsing, job matching, resume tailoring, browser-automation apply agent,
  Gmail scanning. Runs locally (browser automation needs a real display).
- **`frontend/`** — Next.js 14 dashboard. Talks to the backend over `NEXT_PUBLIC_API_URL`. Can run locally or
  deploy to Netlify (see `netlify.toml`, `base = "frontend"`); the backend stays local-first.

## Status

This is Phase 1-4 scaffolding per the project plan: the resume parser + profile dashboard (Phase 1) is fully
wired end-to-end. Job scraping, auto-apply, and email intelligence are implemented against the plan's spec but
need your own credentials (Naukri login, Gmail OAuth) and — because job-board markup drifts constantly — you
should verify the CSS selectors in `backend/modules/job_scraper.py` and `backend/handlers/*.py` against the live
sites in DevTools before relying on them (see the Risk Matrix in the original plan).

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
playwright install chromium
```

Copy `.env.example` (repo root) to `.env` and fill in:

- `ANTHROPIC_API_KEY` — from console.anthropic.com (or set `LLM_PROVIDER=ollama` and run `ollama serve` locally
  instead — Rs.0/month, needs 8GB+ RAM).
- `APP_USERNAME` / `APP_PASSWORD_HASH` — the dashboard's single login. Generate the hash:
  ```bash
  python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('your-password'))"
  ```
- `JWT_SECRET` — any long random string.
- `NAUKRI_USERNAME` / `NAUKRI_PASSWORD` — use a **dedicated** scraping account, never your main one (a block/ban
  risk exists per the plan's Risk Matrix).

Run it:

```bash
uvicorn main:app --reload --port 8000
```

Swagger docs at http://localhost:8000/docs.

### 2. Gmail API (for Email Intelligence)

1. Go to console.cloud.google.com → create a project → enable the **Gmail API**.
2. Create OAuth 2.0 credentials, type **Desktop App**.
3. Download the JSON and save it as `backend/config/credentials.json`.
4. First call to `/api/agent/run-email-scan` (or the scheduled scan) opens a browser for one-time consent —
   read-only (`gmail.readonly`) access only. The refresh token is saved to `backend/config/token.json` and
   reused after that.

Everything runs locally: Gmail API calls go straight from your machine to Google, no middleman server.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000, log in with the username/password you hashed above.

## Safety defaults

- **Dry-run applications** (`DRY_RUN_APPLICATIONS=true` by default): the apply agent fills forms and takes
  screenshots but never clicks submit until you flip this off — do that only after reviewing screenshots from a
  few dry runs.
- **Human-in-the-loop**: jobs land in "new" status for manual approve/reject; only scores above
  `AUTO_APPROVE_ABOVE` (80 by default) skip that step.
- **Daily application cap** (`MAX_APPLICATIONS_PER_DAY`, 15 by default) to avoid looking like spam.

## Project layout

See `backend/modules/`, `backend/handlers/`, `backend/routers/` for the module breakdown, and
`frontend/app/` for the dashboard pages (`/`, `/profile`, `/jobs`, `/applications`, `/inbox`, `/analytics`,
`/settings`). Database schema lives in `backend/database.py` (SQLite by default, single file at
`backend/data/autoapply.db`).
