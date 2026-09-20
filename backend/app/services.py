from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from .models import StudySession, User

TEHRAN = ZoneInfo("Asia/Tehran")


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def iso(value: datetime | None) -> str | None:
    value = as_utc(value)
    return value.isoformat().replace("+00:00", "Z") if value else None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def accumulated(session: StudySession, now: datetime | None = None) -> int:
    total = session.accumulated_seconds or 0
    if session.status == "running" and session.last_resumed_at:
        delta = (now or now_utc()) - as_utc(session.last_resumed_at)
        total += max(0, int(delta.total_seconds()))
    return total


def session_json(session: StudySession) -> dict:
    return {
        "id": session.id,
        "status": session.status,
        "subjectId": session.subject_id,
        "subjectTitle": session.subject.title if session.subject else None,
        "startedAt": iso(session.started_at),
        "lastResumedAt": iso(session.last_resumed_at),
        "pausedAt": iso(session.paused_at),
        "endedAt": iso(session.ended_at),
        "accumulatedSeconds": accumulated(session),
    }


def period_start(period: str) -> datetime | None:
    local = now_utc().astimezone(TEHRAN)
    if period == "day":
        start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        days_since_saturday = (local.weekday() - 5) % 7
        start = (local - timedelta(days=days_since_saturday)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        start = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        return None
    return start.astimezone(timezone.utc)


def ranking(db: Session, period: str) -> list[dict]:
    start = period_start(period)
    stmt = (
        select(User.id, User.full_name, User.level, func.coalesce(func.sum(StudySession.accumulated_seconds), 0).label("seconds"))
        .outerjoin(StudySession, (StudySession.user_id == User.id) & (StudySession.status == "saved"))
        .where(User.role == "student", User.is_active.is_(True))
        .group_by(User.id)
    )
    if start:
        stmt = stmt.where((StudySession.saved_at.is_(None)) | (StudySession.saved_at >= start))
    rows = db.execute(stmt).all()
    rows = sorted(rows, key=lambda row: (-int(row.seconds), row.id))
    return [
        {
            "rank": index,
            "userId": row.id,
            "name": row.full_name,
            "seconds": int(row.seconds),
            "minutes": round(int(row.seconds) / 60, 2),
            "level": row.level,
        }
        for index, row in enumerate(rows, 1)
    ]
