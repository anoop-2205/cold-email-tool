from fastapi import APIRouter, BackgroundTasks, Depends, WebSocket, WebSocketDisconnect

from database import Profile, SessionLocal
from modules.agent_status import hub
from modules.security import CurrentUser, require_auth

router = APIRouter(tags=["agent"])


def _run_scraper_task(user_id: int) -> None:
    from database import Setting, User
    from modules.crypto import decrypt
    from modules.job_scraper import NaukriScraper, SearchQuery, dedupe_new_jobs

    db = SessionLocal()
    try:
        hub.broadcast("scraper.started")
        user = db.get(User, user_id)
        if not (user.naukri_username and user.naukri_password_encrypted):
            hub.broadcast("scraper.error", {"message": "Connect your Naukri account in Settings first."})
            return

        setting = db.query(Setting).filter_by(key=f"search_queries:{user_id}").first()
        queries = (setting.value if setting else None) or [{"keywords": "software engineer", "location": "india"}]

        total_inserted = 0
        scraper = NaukriScraper(user.naukri_username, decrypt(user.naukri_password_encrypted))
        for q in queries:
            scraped_jobs = scraper.search(SearchQuery(**q))
            total_inserted += dedupe_new_jobs(db, user_id, scraped_jobs)
        hub.broadcast("scraper.finished", {"inserted": total_inserted})
    except Exception as exc:  # noqa: BLE001
        hub.broadcast("scraper.error", {"message": str(exc)})
    finally:
        db.close()


def _run_matcher_task(user_id: int) -> None:
    from modules.job_matcher import score_pending_jobs

    db = SessionLocal()
    try:
        hub.broadcast("matcher.started")
        profile = db.query(Profile).filter_by(user_id=user_id).first()
        if not profile:
            hub.broadcast("matcher.error", {"message": "No profile found. Upload a resume first."})
            return
        scored = score_pending_jobs(db, profile, user_id)
        hub.broadcast("matcher.finished", {"scored": len(scored)})
    except Exception as exc:  # noqa: BLE001
        hub.broadcast("matcher.error", {"message": str(exc)})
    finally:
        db.close()


def _run_email_scan_task(user_id: int) -> None:
    from modules.email_scanner import scan_inbox

    db = SessionLocal()
    try:
        hub.broadcast("email_scan.started")
        scans = scan_inbox(db, user_id)
        hub.broadcast("email_scan.finished", {"new_scans": len(scans)})
    except Exception as exc:  # noqa: BLE001
        hub.broadcast("email_scan.error", {"message": str(exc)})
    finally:
        db.close()


@router.post("/api/agent/run-scraper")
def run_scraper(background_tasks: BackgroundTasks, current_user: CurrentUser = Depends(require_auth)):
    background_tasks.add_task(_run_scraper_task, current_user.id)
    return {"status": "started"}


@router.post("/api/agent/run-matcher")
def run_matcher(background_tasks: BackgroundTasks, current_user: CurrentUser = Depends(require_auth)):
    background_tasks.add_task(_run_matcher_task, current_user.id)
    return {"status": "started"}


@router.post("/api/agent/run-email-scan")
def run_email_scan(background_tasks: BackgroundTasks, current_user: CurrentUser = Depends(require_auth)):
    # Scans the current user's own connected Gmail (see routers/gmail.py);
    # 400s at scan time if they haven't connected one yet.
    background_tasks.add_task(_run_email_scan_task, current_user.id)
    return {"status": "started"}


@router.websocket("/ws/agent-status")
async def agent_status_ws(websocket: WebSocket):
    await websocket.accept()
    queue = hub.subscribe()
    try:
        while True:
            message = await queue.get()
            await websocket.send_text(message)
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(queue)
