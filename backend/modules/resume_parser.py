"""Module A: Resume Parser and Profile Engine.

Extracts text from an uploaded resume PDF and asks the LLM to structure it
into the Profile schema (database.Profile). This is the foundation every
other module reads from.
"""
import pdfplumber

from modules.llm import complete_json

SYSTEM_PROMPT = """You are a resume parser. Extract structured data from the resume text.
Return JSON ONLY with exactly this shape:
{
  "full_name": string,
  "email": string,
  "phone": string,
  "location": string,
  "summary": string (2-4 sentence professional summary, write one if the resume lacks it),
  "skills": [string, ...],
  "experience": [{"company": string, "role": string, "duration": string, "bullets": [string, ...]}],
  "education": [{"institution": string, "degree": string, "year": string}],
  "projects": [{"name": string, "description": string, "tech": [string, ...]}],
  "portfolio_url": string (personal website/portfolio link, if present),
  "github_url": string,
  "linkedin_url": string
}
Use "" or [] for fields you cannot find. Do not invent information not present in the resume."""


def extract_text(pdf_path: str) -> str:
    chunks = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                chunks.append(text)
    text = "\n".join(chunks).strip()
    if not text:
        raise ValueError("Could not extract any text from this PDF (it may be a scanned image).")
    return text


def parse_resume(pdf_path: str) -> dict:
    """Read a resume PDF and return a dict matching the Profile schema."""
    raw_text = extract_text(pdf_path)
    profile_data = complete_json(SYSTEM_PROMPT, raw_text, max_tokens=3000)

    # Defensive defaults in case the model omits a key.
    defaults = {
        "full_name": "", "email": "", "phone": "", "location": "", "summary": "",
        "skills": [], "experience": [], "education": [], "projects": [],
        "portfolio_url": "", "github_url": "", "linkedin_url": "",
    }
    return {**defaults, **profile_data}
