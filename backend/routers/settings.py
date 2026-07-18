from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Setting, get_db
from modules.security import CurrentUser, require_auth

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Keys the dashboard is allowed to read/write via this endpoint. Secrets
# (API keys, SMTP/Naukri passwords) stay in .env, never in the DB. Stored
# per-user internally as "{key}:{user_id}" so each candidate has their own
# search queries and thresholds.
KNOWN_KEYS = ["search_queries", "auto_approve_threshold", "auto_reject_threshold", "auto_apply_enabled"]


class SettingOut(BaseModel):
    key: str
    value: dict | list | int | bool | str | None


class SettingsUpdate(BaseModel):
    key: str
    value: dict | list | int | bool | str | None


@router.get("", response_model=list[SettingOut])
def get_settings(db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    rows = {row.key: row for row in db.query(Setting).all() if row.key.endswith(f":{current_user.id}")}
    return [
        SettingOut(key=k, value=rows[f"{k}:{current_user.id}"].value if f"{k}:{current_user.id}" in rows else None)
        for k in KNOWN_KEYS
    ]


@router.put("", response_model=SettingOut)
def update_setting(body: SettingsUpdate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_auth)):
    if body.key not in KNOWN_KEYS:
        raise HTTPException(400, f"Unknown setting key '{body.key}'")
    scoped_key = f"{body.key}:{current_user.id}"
    row = db.get(Setting, scoped_key)
    if row:
        row.value = body.value
    else:
        row = Setting(key=scoped_key, value=body.value)
        db.add(row)
    db.commit()
    db.refresh(row)
    return SettingOut(key=body.key, value=row.value)
