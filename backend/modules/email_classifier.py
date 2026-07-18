"""AI email classification, per the plan's Section 4 prompt spec.

Every scanned email goes through this before being stored, so email_scans
rows always carry a classification + extracted_data pair the dashboard can
render directly.
"""
from modules.llm import complete_json

CATEGORIES = [
    "JOB_ALERT",
    "ACKNOWLEDGMENT",
    "REJECTION",
    "INTERVIEW_INVITE",
    "ASSESSMENT",
    "OFFER",
    "RECRUITER_OUTREACH",
    "IRRELEVANT",
]

SYSTEM_PROMPT = """You are an email classifier for a job seeker.
Classify this email into ONE category:
JOB_ALERT - A job listing notification from a job board
ACKNOWLEDGMENT - Application received confirmation
REJECTION - Application rejected
INTERVIEW_INVITE - Interview scheduling request
ASSESSMENT - Online test or coding challenge link
OFFER - Job offer details
RECRUITER_OUTREACH - Unsolicited recruiter message
IRRELEVANT - Not job-related

Extract: job_title, company_name, link (if any), date
If a link is a long tracking/redirect URL, truncate it to its first 150
characters rather than reproducing it in full.
Return JSON ONLY in this shape:
{"classification": one of the categories above, "job_title": string, "company_name": string, "link": string, "date": string, "notes": string}"""


def classify_email(subject: str, from_address: str, body: str) -> dict:
    user_prompt = f"From: {from_address}\nSubject: {subject}\n\nBody:\n{body[:4000]}"
    result = complete_json(SYSTEM_PROMPT, user_prompt, max_tokens=800)
    classification = result.get("classification", "IRRELEVANT")
    if classification not in CATEGORIES:
        classification = "IRRELEVANT"
    return {
        "classification": classification,
        "extracted_data": {
            "job_title": result.get("job_title", ""),
            "company": result.get("company_name", ""),
            "link": result.get("link", ""),
            "date": result.get("date", ""),
            "notes": result.get("notes", ""),
        },
    }


# Maps an email classification to the Application.status it should set,
# for classifications that represent a response to an application we sent.
CLASSIFICATION_TO_APPLICATION_STATUS = {
    "ACKNOWLEDGMENT": "acknowledged",
    "REJECTION": "rejected",
    "INTERVIEW_INVITE": "interview",
    "ASSESSMENT": "interview",
    "OFFER": "offered",
}
