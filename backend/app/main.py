from contextlib import asynccontextmanager
from collections import defaultdict, deque
from datetime import timedelta
from threading import Lock
from time import monotonic
from typing import Literal
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .deps import admin_user, current_user, superadmin_user
from .models import Announcement, AuditLog, ChatMessage, Group, ProfileChangeRequest, StudySession, Subject, User
from .schemas import AnnouncementIn, AnnouncementUpdateIn, GroupIn, LoginIn, MessageIn, ProfileChangeRequestIn, SessionActionIn, SessionSaveIn, SessionStartIn, SubjectIn, UserCreateIn, UserUpdateIn
from .security import code_digest, create_token, decode_token, generate_login_code, hash_code, verify_code
from .seed import seed
from .services import TEHRAN, accumulated, as_utc, iso, now_utc, period_start, ranking, session_json


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    if settings.seed_demo:
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(title="Hamrah API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginLimiter:
    def __init__(self, attempts: int = 8, window_seconds: int = 300):
        self.attempts = attempts
        self.window = window_seconds
        self.entries = defaultdict(deque)
        self.lock = Lock()

    def check(self, key: str):
        now = monotonic()
        with self.lock:
            values = self.entries[key]
            while values and now - values[0] > self.window:
                values.popleft()
            if len(values) >= self.attempts:
                raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "تلاش‌های ورود بیش از حد مجاز است")
            values.append(now)

    def clear(self, key: str):
        with self.lock:
            self.entries.pop(key, None)


login_limiter = LoginLimiter()


def profile_json(user: User, db: Session) -> dict:
    board = ranking(db, "week") if user.role == "student" else []
    rank = next((item["rank"] for item in board if item["userId"] == user.id), None)
    return {
        "id": user.id,
        "name": user.first_name or user.full_name.split()[0],
        "fullName": user.full_name,
        "publicCode": user.public_code,
        "role": user.role,
        "level": user.level,
        "rank": rank,
        "grade": user.grade,
        "groupId": user.group_id,
        "groupName": user.group.name if user.group else None,
        "consultantName": user.consultant.full_name if user.consultant else None,
    }


def require_student(user: User):
    if user.role != "student":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "این عملیات مخصوص دانش‌آموز است")


def owned_session(db: Session, user: User, session_id: int) -> StudySession:
    session = db.scalar(
        select(StudySession)
        .options(joinedload(StudySession.subject))
        .where(StudySession.id == session_id, StudySession.user_id == user.id)
    )
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "نشست مطالعه پیدا نشد")
    return session


def audit(db: Session, actor: User, action: str, entity_type: str, entity_id: int | str, detail: str | None = None):
    db.add(AuditLog(actor_id=actor.id, action=action, entity_type=entity_type, entity_id=str(entity_id), detail=detail))


def ensure_managed_student(actor: User, target: User):
    if actor.role == "admin" and target.role != "student":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "ادمین عادی فقط به حساب دانش‌آموز دسترسی دارد")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/auth/login")
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    client_key = request.client.host if request.client else "unknown"
    login_limiter.check(client_key)
    code = payload.code.strip()
    user = db.scalar(select(User).where(User.login_code_digest == code_digest(code)))
    if not user or not user.is_active or not verify_code(code, user.login_code_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "رمز عضویت معتبر نیست")
    login_limiter.clear(client_key)
    return {"token": create_token(user.id, user.role), "user": profile_json(user, db)}


@app.post("/api/auth/logout")
def logout(_: User = Depends(current_user)):
    return {"ok": True}


@app.get("/api/auth/me")
@app.get("/api/profile")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return profile_json(user, db)


@app.post("/api/profile-change-requests", status_code=201)
def create_profile_change_request(
    payload: ProfileChangeRequestIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_student(user)
    pending = db.scalar(
        select(ProfileChangeRequest).where(
            ProfileChangeRequest.user_id == user.id,
            ProfileChangeRequest.status == "pending",
        )
    )
    if pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "یک درخواست در انتظار بررسی دارید")
    requested_name = payload.fullName.strip()
    if requested_name == user.full_name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "نام جدید با نام فعلی یکسان است")
    row = ProfileChangeRequest(
        user_id=user.id,
        requested_full_name=requested_name,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "requestedFullName": row.requested_full_name,
        "status": row.status,
        "createdAt": iso(row.created_at),
    }


@app.get("/api/profile-change-requests/me")
def my_profile_change_requests(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(ProfileChangeRequest)
        .where(ProfileChangeRequest.user_id == user.id)
        .order_by(ProfileChangeRequest.created_at.desc())
        .limit(10)
    ).all()
    return {
        "items": [
            {
                "id": row.id,
                "requestedFullName": row.requested_full_name,
                "status": row.status,
                "createdAt": iso(row.created_at),
            }
            for row in rows
        ]
    }


@app.get("/api/subjects")
def subjects(_: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Subject).where(Subject.is_active.is_(True)).order_by(Subject.id)).all()
    return {"items": [{"id": row.id, "title": row.title} for row in rows]}


@app.get("/api/study-stats")
def study_stats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_student(user)
    now = now_utc()
    starts = {key: period_start(key) for key in ("day", "week")}
    totals = {}
    for key, start in starts.items():
        totals[key] = db.scalar(
            select(func.coalesce(func.sum(StudySession.accumulated_seconds), 0)).where(
                StudySession.user_id == user.id,
                StudySession.status == "saved",
                StudySession.saved_at >= start,
            )
        ) or 0
    total = db.scalar(
        select(func.coalesce(func.sum(StudySession.accumulated_seconds), 0)).where(
            StudySession.user_id == user.id, StudySession.status == "saved"
        )
    ) or 0
    active = db.scalar(
        select(StudySession).where(
            StudySession.user_id == user.id, StudySession.status.in_(["running", "paused", "ended"])
        ).order_by(StudySession.id.desc())
    )
    live = accumulated(active, now) if active and active.status != "ended" else 0
    board = ranking(db, "week")
    rank = next((item["rank"] for item in board if item["userId"] == user.id), None)
    saved_dates = {
        as_utc(value).astimezone(TEHRAN).date()
        for value in db.scalars(
            select(StudySession.saved_at).where(
                StudySession.user_id == user.id,
                StudySession.status == "saved",
                StudySession.saved_at.is_not(None),
            )
        )
    }
    cursor = now.astimezone(TEHRAN).date()
    if cursor not in saved_dates:
        cursor -= timedelta(days=1)
    streak = 0
    while cursor in saved_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return {
        "totalSeconds": int(total),
        "weekSeconds": int(totals["week"]) + live,
        "todaySeconds": int(totals["day"]) + live,
        "totalMinutes": round(int(total) / 60, 2),
        "weekMinutes": round((int(totals["week"]) + live) / 60, 2),
        "todayMinutes": round((int(totals["day"]) + live) / 60, 2),
        "rank": rank,
        "level": user.level,
        "streakDays": streak,
    }


@app.get("/api/subjects/stats")
def subject_stats(
    period: Literal["day", "week", "month", "all"] = "all",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_student(user)
    start = period_start(period)
    stmt = (
        select(Subject.id, Subject.title, func.coalesce(func.sum(StudySession.accumulated_seconds), 0).label("seconds"))
        .outerjoin(
            StudySession,
            (StudySession.subject_id == Subject.id)
            & (StudySession.user_id == user.id)
            & (StudySession.status == "saved"),
        )
        .where(Subject.is_active.is_(True))
        .group_by(Subject.id)
        .order_by(Subject.id)
    )
    if start:
        stmt = stmt.where(or_(StudySession.saved_at.is_(None), StudySession.saved_at >= start))
    return {
        "items": [
            {
                "subjectId": row.id,
                "title": row.title,
                "seconds": int(row.seconds),
                "minutes": round(int(row.seconds) / 60, 2),
            }
            for row in db.execute(stmt)
        ]
    }


@app.post("/api/study-sessions/start", status_code=201)
def start_session(payload: SessionStartIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_student(user)
    existing = db.scalar(
        select(StudySession).where(
            StudySession.user_id == user.id, StudySession.status.in_(["running", "paused", "ended"])
        )
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "یک نشست ثبت‌نشده دارید")
    subject = db.get(Subject, payload.subjectId)
    if not subject or not subject.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "درس پیدا نشد")
    now = now_utc()
    session = StudySession(user_id=user.id, subject_id=subject.id, started_at=now, last_resumed_at=now)
    db.add(session)
    db.commit()
    db.refresh(session)
    session.subject = subject
    return session_json(session)


@app.post("/api/study-sessions/pause")
def pause_session(payload: SessionActionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = owned_session(db, user, payload.sessionId)
    if session.status != "running":
        raise HTTPException(status.HTTP_409_CONFLICT, "تایمر در حال اجرا نیست")
    now = now_utc()
    session.accumulated_seconds = accumulated(session, now)
    session.status = "paused"
    session.last_resumed_at = None
    session.paused_at = now
    db.commit()
    return session_json(session)


@app.post("/api/study-sessions/resume")
def resume_session(payload: SessionActionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = owned_session(db, user, payload.sessionId)
    if session.status != "paused":
        raise HTTPException(status.HTTP_409_CONFLICT, "تایمر متوقف نیست")
    session.status = "running"
    session.last_resumed_at = now_utc()
    session.paused_at = None
    db.commit()
    return session_json(session)


@app.post("/api/study-sessions/end")
def end_session(payload: SessionActionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = owned_session(db, user, payload.sessionId)
    if session.status not in {"running", "paused"}:
        raise HTTPException(status.HTTP_409_CONFLICT, "نشست قبلاً پایان یافته است")
    now = now_utc()
    session.accumulated_seconds = accumulated(session, now)
    session.status = "ended"
    session.last_resumed_at = None
    session.ended_at = now
    db.commit()
    return session_json(session)


@app.post("/api/study-sessions/save")
def save_session(payload: SessionSaveIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = owned_session(db, user, payload.sessionId)
    if session.status != "ended":
        raise HTTPException(status.HTTP_409_CONFLICT, "ابتدا تایمر را پایان دهید")
    if session.accumulated_seconds < settings.min_session_seconds:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "مدت مطالعه بیش از حد کوتاه است")
    if session.accumulated_seconds > 16 * 3600:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "مدت مطالعه نامعتبر است")
    if payload.subjectId:
        subject = db.get(Subject, payload.subjectId)
        if not subject or not subject.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "درس پیدا نشد")
        session.subject_id = subject.id
    session.note = payload.note.strip() if payload.note else None
    session.status = "saved"
    session.saved_at = now_utc()
    db.commit()
    return {
        "saved": True,
        "seconds": session.accumulated_seconds,
        "minutes": round(session.accumulated_seconds / 60, 2),
        "sessionId": session.id,
    }


@app.delete("/api/study-sessions/{session_id}")
def discard_session(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = owned_session(db, user, session_id)
    if session.status == "saved":
        raise HTTPException(status.HTTP_409_CONFLICT, "نشست ثبت‌شده قابل حذف نیست")
    db.delete(session)
    db.commit()
    return {"discarded": True, "sessionId": session_id}


@app.get("/api/study-sessions/active")
def active_session(user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.scalar(
        select(StudySession)
        .options(joinedload(StudySession.subject))
        .where(StudySession.user_id == user.id, StudySession.status.in_(["running", "paused", "ended"]))
        .order_by(StudySession.id.desc())
    )
    return session_json(session) if session else None


@app.get("/api/leaderboard")
def leaderboard(
    period: Literal["day", "week", "month", "all"] = "week",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    items = ranking(db, period)
    mine = next((item for item in items if item["userId"] == user.id), None)
    others = [item for item in items if item["userId"] != user.id]
    if mine:
        mine = {**mine, "isMe": True}
    return {"items": others, "me": mine}


@app.get("/api/announcements")
def announcements(user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Announcement).where(
        Announcement.is_active.is_(True),
        or_(Announcement.target_group_id.is_(None), Announcement.target_group_id == user.group_id),
    ).order_by(Announcement.created_at.desc())
    rows = db.scalars(stmt).all()
    return {
        "items": [
            {"id": row.id, "title": row.title, "body": row.body, "tone": row.tone, "imageUrl": row.image_url, "createdAt": iso(row.created_at)}
            for row in rows
        ]
    }


@app.get("/api/chat/messages")
def messages(
    studentId: int | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    target_id = user.id
    if user.role in {"admin", "superadmin"}:
        if not studentId:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "studentId الزامی است")
        target = db.get(User, studentId)
        if not target or target.role != "student" or not target.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "دانش‌آموز پیدا نشد")
        target_id = studentId
    rows = db.scalars(select(ChatMessage).where(ChatMessage.student_id == target_id).order_by(ChatMessage.created_at)).all()
    return {
        "items": [
            {
                "id": row.id,
                "from": "me" if row.sender_id == user.id else "consultant",
                "text": row.text,
                "createdAt": iso(row.created_at),
                "status": "sent",
            }
            for row in rows
        ]
    }


@app.post("/api/chat/messages", status_code=201)
async def send_message(payload: MessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "متن پیام خالی است")
    student_id = user.id
    if user.role in {"admin", "superadmin"}:
        if not payload.studentId:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "studentId الزامی است")
        target = db.get(User, payload.studentId)
        if not target or target.role != "student" or not target.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "دانش‌آموز پیدا نشد")
        student_id = payload.studentId
    message = ChatMessage(student_id=student_id, sender_id=user.id, text=text)
    db.add(message)
    db.commit()
    db.refresh(message)
    result = {"id": message.id, "from": "me", "text": message.text, "createdAt": iso(message.created_at), "status": "sent"}
    await hub.publish(student_id, {**result, "from": "me" if user.role == "student" else "consultant"}, skip_user_id=user.id)
    return result


@app.get("/api/admin/dashboard")
def admin_dashboard(actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    today = period_start("day")
    student_filter = [User.role == "student", User.is_active.is_(True)]
    timer_filter = []
    if actor.role == "admin":
        student_filter.append(User.consultant_id == actor.id)
        timer_filter.append(User.consultant_id == actor.id)
    return {
        "students": db.scalar(select(func.count()).select_from(User).where(*student_filter)),
        "groups": db.scalar(select(func.count()).select_from(Group).where(Group.is_active.is_(True))),
        "activeTimers": db.scalar(
            select(func.count())
            .select_from(StudySession)
            .join(User, User.id == StudySession.user_id)
            .where(StudySession.status.in_(["running", "paused"]), *timer_filter)
        ),
        "todayStudyMinutes": int(
            db.scalar(
                select(func.coalesce(func.sum(StudySession.accumulated_seconds), 0))
                .join(User, User.id == StudySession.user_id)
                .where(StudySession.status == "saved", StudySession.saved_at >= today, *timer_filter)
            )
            or 0
        )
        // 60,
    }


@app.get("/api/admin/users")
def admin_users(
    role: str | None = None,
    groupId: int | None = None,
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    actor: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    stmt = select(User).options(joinedload(User.group)).order_by(User.id.desc())
    if actor.role == "admin":
        stmt = stmt.where(User.role == "student")
    if role:
        stmt = stmt.where(User.role == role)
    if groupId:
        stmt = stmt.where(User.group_id == groupId)
    if search:
        stmt = stmt.where(or_(User.full_name.contains(search), User.public_code.contains(search)))
    rows = db.scalars(stmt.offset(skip).limit(limit)).all()
    return {"items": [profile_json(row, db) | {"isActive": row.is_active} for row in rows]}


@app.post("/api/admin/users", status_code=201)
def create_user(payload: UserCreateIn, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    allowed = {"student", "admin"} if actor.role == "superadmin" else {"student"}
    if payload.role not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "اجازه ساخت این نقش را ندارید")
    login_code = payload.loginCode or generate_login_code()
    public_code = payload.publicCode or f"ST-{generate_login_code(6)}"
    user = User(
        public_code=public_code,
        login_code_digest=code_digest(login_code),
        login_code_hash=hash_code(login_code),
        full_name=payload.fullName.strip(),
        first_name=(payload.firstName or payload.fullName.split()[0]).strip(),
        role=payload.role,
        grade=payload.grade if payload.role == "student" else None,
        level=payload.level,
        group_id=payload.groupId,
        consultant_id=actor.id if actor.role == "admin" else payload.consultantId,
    )
    db.add(user)
    try:
        db.flush()
        audit(db, actor, "user.create", "user", user.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "کد کاربری یا رمز عضویت تکراری است")
    return {"user": profile_json(user, db), "loginCode": login_code}


@app.patch("/api/admin/users/{user_id}")
def update_user(user_id: int, payload: UserUpdateIn, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "کاربر پیدا نشد")
    ensure_managed_student(actor, user)
    if user.role in {"admin", "superadmin"} and actor.role != "superadmin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "اجازه ویرایش این کاربر را ندارید")
    values = payload.model_dump(exclude_unset=True)
    mapping = {"fullName": "full_name", "firstName": "first_name", "groupId": "group_id", "consultantId": "consultant_id", "isActive": "is_active"}
    if values.get("role") and actor.role != "superadmin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "تغییر نقش مخصوص سوپرادمین است")
    new_code = None
    for key, value in values.items():
        if key == "resetLoginCode":
            if value:
                new_code = generate_login_code()
                user.login_code_digest = code_digest(new_code)
                user.login_code_hash = hash_code(new_code)
            continue
        if key == "newLoginCode":
            if value:
                new_code = value.strip()
                user.login_code_digest = code_digest(new_code)
                user.login_code_hash = hash_code(new_code)
            continue
        setattr(user, mapping.get(key, key), value)
    audit(db, actor, "user.update", "user", user.id)
    db.commit()
    result = {"user": profile_json(user, db)}
    if new_code:
        result["loginCode"] = new_code
    return result


@app.delete("/api/admin/users/{user_id}")
def disable_user(user_id: int, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "کاربر پیدا نشد")
    ensure_managed_student(actor, user)
    if user.role != "student" and actor.role != "superadmin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "اجازه غیرفعال‌سازی این کاربر را ندارید")
    user.is_active = False
    audit(db, actor, "user.disable", "user", user.id)
    db.commit()
    return {"ok": True}


@app.get("/api/admin/groups")
def admin_groups(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Group).where(Group.is_active.is_(True)).order_by(Group.name)).all()
    return {"items": [{"id": row.id, "name": row.name} for row in rows]}


@app.post("/api/admin/groups", status_code=201)
def create_group(payload: GroupIn, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    group = Group(name=payload.name.strip())
    db.add(group)
    try:
        db.flush()
        audit(db, actor, "group.create", "group", group.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "نام گروه تکراری است")
    return {"id": group.id, "name": group.name}


@app.patch("/api/admin/groups/{group_id}")
def update_group(group_id: int, payload: GroupIn, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "گروه پیدا نشد")
    group.name = payload.name.strip()
    audit(db, actor, "group.update", "group", group.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "نام گروه تکراری است")
    return {"id": group.id, "name": group.name}


@app.delete("/api/admin/groups/{group_id}")
def disable_group(group_id: int, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "گروه پیدا نشد")
    group.is_active = False
    audit(db, actor, "group.disable", "group", group.id)
    db.commit()
    return {"ok": True}


@app.get("/api/admin/subjects")
def admin_subjects(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Subject).order_by(Subject.id)).all()
    return {"items": [{"id": row.id, "title": row.title, "isActive": row.is_active} for row in rows]}


@app.post("/api/admin/subjects", status_code=201)
def create_subject(payload: SubjectIn, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    subject = Subject(title=payload.title.strip())
    db.add(subject)
    try:
        db.flush()
        audit(db, actor, "subject.create", "subject", subject.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "نام درس تکراری است")
    return {"id": subject.id, "title": subject.title}


@app.patch("/api/admin/subjects/{subject_id}")
def update_subject(subject_id: int, payload: SubjectIn, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "درس پیدا نشد")
    subject.title = payload.title.strip()
    audit(db, actor, "subject.update", "subject", subject.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "نام درس تکراری است")
    return {"id": subject.id, "title": subject.title}


@app.delete("/api/admin/subjects/{subject_id}")
def disable_subject(subject_id: int, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "درس پیدا نشد")
    subject.is_active = False
    audit(db, actor, "subject.disable", "subject", subject.id)
    db.commit()
    return {"ok": True}


@app.get("/api/admin/announcements")
def admin_announcements(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Announcement).order_by(Announcement.created_at.desc())).all()
    return {"items": [{"id": row.id, "title": row.title, "body": row.body, "tone": row.tone, "imageUrl": row.image_url, "targetGroupId": row.target_group_id, "isActive": row.is_active, "createdAt": iso(row.created_at)} for row in rows]}


@app.post("/api/admin/announcements", status_code=201)
def create_announcement(payload: AnnouncementIn, actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    row = Announcement(title=payload.title.strip(), body=payload.body.strip(), tone=payload.tone, image_url=payload.imageUrl, target_group_id=payload.targetGroupId, created_by=actor.id)
    db.add(row)
    db.flush()
    audit(db, actor, "announcement.create", "announcement", row.id)
    db.commit()
    return {"id": row.id, "createdAt": iso(row.created_at)}


@app.patch("/api/admin/announcements/{announcement_id}")
def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdateIn,
    actor: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    row = db.get(Announcement, announcement_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "اعلان پیدا نشد")
    mapping = {"imageUrl": "image_url", "targetGroupId": "target_group_id", "isActive": "is_active"}
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, mapping.get(key, key), value.strip() if isinstance(value, str) else value)
    audit(db, actor, "announcement.update", "announcement", row.id)
    db.commit()
    return {"ok": True}


@app.delete("/api/admin/announcements/{announcement_id}")
def disable_announcement(
    announcement_id: int,
    actor: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    row = db.get(Announcement, announcement_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "اعلان پیدا نشد")
    row.is_active = False
    audit(db, actor, "announcement.disable", "announcement", row.id)
    db.commit()
    return {"ok": True}


@app.get("/api/admin/study-sessions")
def admin_study_sessions(
    userId: int | None = None,
    statusValue: str | None = Query(default=None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    actor: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    stmt = select(StudySession).options(joinedload(StudySession.user), joinedload(StudySession.subject)).order_by(StudySession.id.desc())
    if actor.role == "admin":
        stmt = stmt.join(User, User.id == StudySession.user_id).where(User.consultant_id == actor.id)
    if userId:
        stmt = stmt.where(StudySession.user_id == userId)
    if statusValue:
        stmt = stmt.where(StudySession.status == statusValue)
    rows = db.scalars(stmt.limit(limit)).all()
    return {"items": [{**session_json(row), "userId": row.user_id, "userName": row.user.full_name, "note": row.note, "savedAt": iso(row.saved_at)} for row in rows]}


@app.get("/api/admin/chats")
def admin_chats(actor: User = Depends(admin_user), db: Session = Depends(get_db)):
    last_at = func.max(ChatMessage.created_at).label("last_at")
    stmt = (
        select(
            User.id.label("student_id"),
            User.full_name,
            func.count(ChatMessage.id).label("message_count"),
            last_at,
        )
        .outerjoin(ChatMessage, ChatMessage.student_id == User.id)
        .where(User.role == "student", User.is_active.is_(True))
        .group_by(User.id, User.full_name)
        .order_by(last_at.desc(), User.full_name)
    )
    rows = db.execute(stmt).all()
    return {"items": [{"studentId": row.student_id, "studentName": row.full_name, "messageCount": row.message_count, "lastMessageAt": iso(row.last_at)} for row in rows]}


@app.get("/api/admin/profile-change-requests")
def admin_profile_change_requests(
    requestStatus: str | None = Query(default=None, alias="status"),
    _: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(ProfileChangeRequest)
        .options(joinedload(ProfileChangeRequest.user))
        .order_by(ProfileChangeRequest.created_at.desc())
    )
    if requestStatus:
        stmt = stmt.where(ProfileChangeRequest.status == requestStatus)
    rows = db.scalars(stmt.limit(200)).all()
    return {
        "items": [
            {
                "id": row.id,
                "userId": row.user_id,
                "currentFullName": row.user.full_name,
                "requestedFullName": row.requested_full_name,
                "status": row.status,
                "createdAt": iso(row.created_at),
                "reviewedAt": iso(row.reviewed_at),
            }
            for row in rows
        ]
    }


@app.post("/api/admin/profile-change-requests/{request_id}/approve")
def approve_profile_change_request(
    request_id: int,
    actor: User = Depends(superadmin_user),
    db: Session = Depends(get_db),
):
    row = db.scalar(
        select(ProfileChangeRequest)
        .options(joinedload(ProfileChangeRequest.user))
        .where(ProfileChangeRequest.id == request_id)
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "درخواست پیدا نشد")
    if row.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "این درخواست قبلاً بررسی شده است")
    row.user.full_name = row.requested_full_name
    row.user.first_name = row.requested_full_name.split()[0]
    row.status = "approved"
    row.reviewed_by = actor.id
    row.reviewed_at = now_utc()
    audit(db, actor, "profile-change.approve", "profile_change_request", row.id)
    db.commit()
    return {"ok": True}


@app.post("/api/admin/profile-change-requests/{request_id}/reject")
def reject_profile_change_request(
    request_id: int,
    actor: User = Depends(superadmin_user),
    db: Session = Depends(get_db),
):
    row = db.get(ProfileChangeRequest, request_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "درخواست پیدا نشد")
    if row.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "این درخواست قبلاً بررسی شده است")
    row.status = "rejected"
    row.reviewed_by = actor.id
    row.reviewed_at = now_utc()
    audit(db, actor, "profile-change.reject", "profile_change_request", row.id)
    db.commit()
    return {"ok": True}


@app.get("/api/admin/audit-logs")
def audit_logs(
    limit: int = Query(100, ge=1, le=500),
    _: User = Depends(superadmin_user),
    db: Session = Depends(get_db),
):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return {"items": [{"id": row.id, "actorId": row.actor_id, "action": row.action, "entityType": row.entity_type, "entityId": row.entity_id, "detail": row.detail, "createdAt": iso(row.created_at)} for row in rows]}


class ChatHub:
    def __init__(self):
        self.clients: dict[int, set[tuple[int, WebSocket]]] = {}

    async def connect(self, student_id: int, user_id: int, ws: WebSocket):
        await ws.accept()
        self.clients.setdefault(student_id, set()).add((user_id, ws))

    def disconnect(self, student_id: int, user_id: int, ws: WebSocket):
        self.clients.get(student_id, set()).discard((user_id, ws))

    async def publish(self, student_id: int, message: dict, skip_user_id: int | None = None):
        for user_id, ws in list(self.clients.get(student_id, set())):
            if user_id == skip_user_id:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(student_id, user_id, ws)


hub = ChatHub()


@app.websocket("/api/ws/chat")
async def chat_socket(ws: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except Exception:
        await ws.close(code=4401)
        return
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if not user or not user.is_active:
            await ws.close(code=4401)
            return
        student_id = user.id if user.role == "student" else int(ws.query_params.get("studentId", "0"))
        if not student_id:
            await ws.close(code=4400)
            return
        target = db.get(User, student_id)
        if not target or target.role != "student" or not target.is_active:
            await ws.close(code=4403)
            return
    await hub.connect(student_id, user.id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(student_id, user.id, ws)


dist_dir = Path(__file__).resolve().parents[2] / "dist"
if dist_dir.is_dir():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
