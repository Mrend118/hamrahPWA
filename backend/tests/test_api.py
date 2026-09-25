import os
os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/hamrah-pytest.db")
os.environ.setdefault("SECRET_KEY", "pytest-secret")
os.environ.setdefault("SEED_DEMO", "true")

from fastapi.testclient import TestClient
from sqlalchemy import select
from backend.app.database import Base, SessionLocal, engine
from backend.app.main import app
from backend.app.models import StudySession


def auth(client, code):
    response = client.post("/api/auth/login", json={"code": code})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def setup_function():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


def test_student_timer_flow():
    with TestClient(app) as client:
        headers = auth(client, "12345678")
        started = client.post("/api/study-sessions/start", headers=headers, json={"subjectId": 1})
        assert started.status_code == 201
        session_id = started.json()["id"]
        assert client.post("/api/study-sessions/start", headers=headers, json={"subjectId": 2}).status_code == 409
        assert client.post("/api/study-sessions/pause", headers=headers, json={"sessionId": session_id}).status_code == 200
        assert client.post("/api/study-sessions/resume", headers=headers, json={"sessionId": session_id}).status_code == 200
        assert client.post("/api/study-sessions/end", headers=headers, json={"sessionId": session_id}).status_code == 200
        with SessionLocal() as db:
            row = db.scalar(select(StudySession).where(StudySession.id == session_id))
            row.accumulated_seconds = 3600
            db.commit()
        saved = client.post("/api/study-sessions/save", headers=headers, json={"sessionId": session_id, "subjectId": 1})
        assert saved.status_code == 200
        assert saved.json()["minutes"] == 60
        assert client.get("/api/study-stats", headers=headers).json()["totalMinutes"] == 60
        assert client.get("/api/study-sessions/active", headers=headers).json() is None


def test_rejected_short_session_can_be_discarded():
    with TestClient(app) as client:
        headers = auth(client, "12345678")
        started = client.post("/api/study-sessions/start", headers=headers, json={"subjectId": 1})
        session_id = started.json()["id"]
        assert client.post("/api/study-sessions/end", headers=headers, json={"sessionId": session_id}).status_code == 200
        assert client.post("/api/study-sessions/save", headers=headers, json={"sessionId": session_id}).status_code == 422
        assert client.delete(f"/api/study-sessions/{session_id}", headers=headers).status_code == 200
        assert client.post("/api/study-sessions/start", headers=headers, json={"subjectId": 2}).status_code == 201


def test_seconds_are_saved_without_rounding_to_one_minute():
    with TestClient(app) as client:
        headers = auth(client, "12345678")
        started = client.post("/api/study-sessions/start", headers=headers, json={"subjectId": 1})
        session_id = started.json()["id"]
        client.post("/api/study-sessions/end", headers=headers, json={"sessionId": session_id})
        with SessionLocal() as db:
            row = db.scalar(select(StudySession).where(StudySession.id == session_id))
            row.accumulated_seconds = 21
            db.commit()
        saved = client.post("/api/study-sessions/save", headers=headers, json={"sessionId": session_id})
        assert saved.json()["seconds"] == 21
        assert saved.json()["minutes"] == 0.35
        assert client.get("/api/study-stats", headers=headers).json()["totalSeconds"] == 21
        assert client.get("/api/leaderboard", headers=headers).json()["me"]["seconds"] == 21


def test_roles_and_admin_crud():
    with TestClient(app) as client:
        student = auth(client, "12345678")
        admin = auth(client, "87654321")
        superadmin = auth(client, "98765432")
        assert client.get("/api/admin/dashboard", headers=student).status_code == 403
        created = client.post("/api/admin/users", headers=admin, json={"fullName": "دانش آموز جدید"})
        assert created.status_code == 201
        assert created.json()["loginCode"]
        forbidden = client.post("/api/admin/users", headers=admin, json={"fullName": "مدیر جدید", "role": "admin"})
        assert forbidden.status_code == 403
        allowed = client.post("/api/admin/users", headers=superadmin, json={"fullName": "مدیر جدید", "role": "admin"})
        assert allowed.status_code == 201
        student_id = client.get("/api/admin/users", headers=admin).json()["items"][0]["id"]
        reset_student = client.patch(
            f"/api/admin/users/{student_id}",
            headers=admin,
            json={"resetLoginCode": True},
        )
        assert reset_student.status_code == 200
        assert reset_student.json()["loginCode"]
        assert client.patch(
            f"/api/admin/users/{allowed.json()['user']['id']}",
            headers=admin,
            json={"resetLoginCode": True},
        ).status_code == 403
        announcement = client.post(
            "/api/admin/announcements",
            headers=admin,
            json={"title": "آزمون", "body": "این یک اطلاعیه آزمایشی است", "tone": "info"},
        )
        assert announcement.status_code == 201


def test_chat_and_announcements():
    with TestClient(app) as client:
        student = auth(client, "12345678")
        sent = client.post("/api/chat/messages", headers=student, json={"text": "سلام"})
        assert sent.status_code == 201
        assert client.get("/api/chat/messages", headers=student).json()["items"][0]["text"] == "سلام"
        assert client.get("/api/announcements", headers=student).status_code == 200


def test_profile_change_requires_superadmin_approval():
    with TestClient(app) as client:
        student = auth(client, "12345678")
        admin = auth(client, "87654321")
        superadmin = auth(client, "98765432")
        created = client.post(
            "/api/profile-change-requests",
            headers=student,
            json={"fullName": "علی نام جدید"},
        )
        assert created.status_code == 201
        request_id = created.json()["id"]
        assert client.post(
            f"/api/admin/profile-change-requests/{request_id}/approve",
            headers=admin,
        ).status_code == 403
        assert client.post(
            f"/api/admin/profile-change-requests/{request_id}/approve",
            headers=superadmin,
        ).status_code == 200
        assert client.get("/api/profile", headers=student).json()["fullName"] == "علی نام جدید"


def test_admin_can_start_chat_with_any_active_student_and_has_no_grade():
    with TestClient(app) as client:
        admin = auth(client, "87654321")
        superadmin = auth(client, "98765432")
        created = client.post(
            "/api/admin/users",
            headers=superadmin,
            json={"fullName": "دانش آموز آزاد", "role": "student", "grade": "یازدهم"},
        )
        student_id = created.json()["user"]["id"]
        sent = client.post(
            "/api/chat/messages",
            headers=admin,
            json={"studentId": student_id, "text": "سلام، برای مشاوره در خدمتم"},
        )
        assert sent.status_code == 201
        new_admin = client.post(
            "/api/admin/users",
            headers=superadmin,
            json={"fullName": "ادمین بدون پایه", "role": "admin", "grade": "نباید ذخیره شود"},
        )
        assert new_admin.status_code == 201
        assert new_admin.json()["user"]["grade"] is None


def test_curriculum_group_stats_and_own_password():
    with TestClient(app) as client:
        admin = auth(client, "87654321")
        superadmin = auth(client, "98765432")
        admins = client.get("/api/admin/users", headers=superadmin).json()["items"]
        consultant = next(item for item in admins if item["role"] == "admin")
        curriculum = client.get("/api/admin/curriculum", headers=superadmin, params={"track": "middle", "grade": "نهم"})
        assert curriculum.status_code == 200
        subjects = curriculum.json()["items"]
        assert {"ریاضی", "علوم تجربی"}.issubset({item["title"] for item in subjects})
        selected = subjects[:3]
        group = client.post("/api/admin/groups", headers=superadmin, json={
            "name": "گروه نهم", "track": "middle", "grade": "نهم",
            "consultantId": consultant["id"], "subjectIds": [item["id"] for item in selected],
        })
        assert group.status_code == 201
        created = client.post("/api/admin/users", headers=superadmin, json={
            "fullName": "دانش‌آموز نهم", "role": "student", "grade": "نهم", "groupId": group.json()["id"],
        })
        student_id = created.json()["user"]["id"]
        student = auth(client, created.json()["loginCode"])
        assert {item["id"] for item in client.get("/api/subjects", headers=student).json()["items"]} == {item["id"] for item in selected}
        started = client.post("/api/study-sessions/start", headers=student, json={"subjectId": selected[0]["id"]})
        session_id = started.json()["id"]
        client.post("/api/study-sessions/end", headers=student, json={"sessionId": session_id})
        with SessionLocal() as db:
            row = db.get(StudySession, session_id)
            row.accumulated_seconds = 3960
            db.commit()
        client.post("/api/study-sessions/save", headers=student, json={"sessionId": session_id})
        stats = client.get(f"/api/admin/users/{student_id}/study-stats", headers=admin)
        assert stats.status_code == 200
        assert stats.json()["totalSeconds"] == 3960
        changed = client.post("/api/auth/change-password", headers=superadmin, json={"currentCode": "98765432", "newCode": "New-SA-987654"})
        assert changed.status_code == 200
        assert client.post("/api/auth/login", json={"code": "New-SA-987654"}).status_code == 200
