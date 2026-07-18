# Playwright's official image bundles Chromium + every OS dependency it
# needs -- far more reliable than "playwright install --with-deps" on a
# generic python:slim image, which routinely fails on missing system libs.
FROM mcr.microsoft.com/playwright/python:v1.49.0-noble

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Re-run install so the browser build matches whatever `playwright` pip
# version requirements.txt actually pinned (may differ slightly from the
# base image's preinstalled version).
RUN playwright install chromium

COPY . .

# data/ holds the SQLite DB + uploaded resumes/screenshots -- mount a
# volume here in production or every deploy wipes candidate data.
RUN mkdir -p data/resumes data/screenshots config

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
