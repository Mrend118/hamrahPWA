from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import Announcement, Group, Subject, User
from .security import code_digest, hash_code

SUBJECTS = ["ریاضی", "فیزیک", "شیمی", "زیست", "زبان انگلیسی", "ادبیات", "عربی", "دینی"]


def add_user(db: Session, public_code: str, code: str, full_name: str, role: str, **kwargs) -> User:
    user = User(
        public_code=public_code,
        login_code_digest=code_digest(code),
        login_code_hash=hash_code(code),
        full_name=full_name,
        first_name=full_name.split()[0],
        role=role,
        **kwargs,
    )
    db.add(user)
    db.flush()
    return user


def seed(db: Session):
    if db.scalar(select(User.id).limit(1)):
        return
    group = Group(name="گروه آزمایشی")
    db.add(group)
    db.flush()
    superadmin = add_user(db, "SA-001", "98765432", "مدیر اصلی", "superadmin")
    consultant = add_user(db, "AD-001", "87654321", "خانم موسوی", "admin")
    add_user(
        db,
        "ST-026",
        "12345678",
        "علی رضایی",
        "student",
        grade="دوازدهم تجربی",
        level=12,
        group_id=group.id,
        consultant_id=consultant.id,
    )
    for title in SUBJECTS:
        db.add(Subject(title=title))
    db.add(
        Announcement(
            title="به همراه خوش آمدید",
            body="زمان مطالعه خود را ثبت کنید و پیشرفتتان را ببینید.",
            tone="info",
            created_by=superadmin.id,
        )
    )
    db.commit()
