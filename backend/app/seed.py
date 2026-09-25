from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import Announcement, Group, GroupProfile, GroupSubject, Subject, SubjectCurriculum, User
from .security import code_digest, hash_code

SUBJECTS = ["ریاضی", "فیزیک", "شیمی", "زیست", "زبان انگلیسی", "ادبیات", "عربی", "دینی"]

CURRICULA = {
    ("middle", "هفتم"): ["ریاضی", "علوم تجربی", "فارسی", "نگارش", "عربی", "زبان انگلیسی", "قرآن", "پیام‌های آسمان", "مطالعات اجتماعی", "کار و فناوری", "فرهنگ و هنر"],
    ("middle", "هشتم"): ["ریاضی", "علوم تجربی", "فارسی", "نگارش", "عربی", "زبان انگلیسی", "قرآن", "پیام‌های آسمان", "مطالعات اجتماعی", "کار و فناوری", "فرهنگ و هنر"],
    ("middle", "نهم"): ["ریاضی", "علوم تجربی", "فارسی", "نگارش", "عربی", "زبان انگلیسی", "قرآن", "پیام‌های آسمان", "مطالعات اجتماعی", "کار و فناوری", "فرهنگ و هنر", "آمادگی دفاعی"],
    ("math", "دهم"): ["ریاضی", "هندسه", "فیزیک", "شیمی", "فارسی", "عربی", "دینی", "زبان انگلیسی"],
    ("math", "یازدهم"): ["حسابان", "هندسه", "آمار و احتمال", "فیزیک", "شیمی", "فارسی", "عربی", "دینی", "زبان انگلیسی"],
    ("math", "دوازدهم"): ["حسابان", "هندسه", "ریاضیات گسسته", "فیزیک", "شیمی", "فارسی", "عربی", "دینی", "زبان انگلیسی"],
    ("experimental", "دهم"): ["ریاضی", "زیست", "فیزیک", "شیمی", "فارسی", "عربی", "دینی", "زبان انگلیسی"],
    ("experimental", "یازدهم"): ["ریاضی", "زیست", "فیزیک", "شیمی", "زمین‌شناسی", "فارسی", "عربی", "دینی", "زبان انگلیسی"],
    ("experimental", "دوازدهم"): ["ریاضی", "زیست", "فیزیک", "شیمی", "فارسی", "عربی", "دینی", "زبان انگلیسی"],
    ("humanities", "دهم"): ["ریاضی و آمار", "اقتصاد", "علوم و فنون ادبی", "جامعه‌شناسی", "منطق", "تاریخ", "جغرافیا", "فارسی", "عربی", "دینی", "زبان انگلیسی"],
    ("humanities", "یازدهم"): ["ریاضی و آمار", "علوم و فنون ادبی", "جامعه‌شناسی", "فلسفه", "روان‌شناسی", "تاریخ", "جغرافیا", "فارسی", "عربی", "دینی", "زبان انگلیسی"],
    ("humanities", "دوازدهم"): ["ریاضی و آمار", "علوم و فنون ادبی", "جامعه‌شناسی", "فلسفه", "تاریخ", "جغرافیا", "فارسی", "عربی", "دینی", "زبان انگلیسی"],
}


def seed_curriculum(db: Session):
    subjects = {row.title: row for row in db.scalars(select(Subject)).all()}
    for title in sorted({title for titles in CURRICULA.values() for title in titles}):
        if title not in subjects:
            subjects[title] = Subject(title=title)
            db.add(subjects[title])
    db.flush()
    existing = {(row.subject_id, row.track, row.grade) for row in db.scalars(select(SubjectCurriculum)).all()}
    for (track, grade), titles in CURRICULA.items():
        for title in titles:
            key = (subjects[title].id, track, grade)
            if key not in existing:
                db.add(SubjectCurriculum(subject_id=key[0], track=track, grade=grade))
    db.commit()


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
        seed_curriculum(db)
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
    seed_curriculum(db)
    db.add(GroupProfile(group_id=group.id, track="experimental", grade="دوازدهم", consultant_id=consultant.id))
    rows = db.scalars(
        select(Subject).join(SubjectCurriculum).where(
            SubjectCurriculum.track == "experimental",
            SubjectCurriculum.grade == "دوازدهم",
        )
    ).all()
    db.add_all([GroupSubject(group_id=group.id, subject_id=row.id) for row in rows])
    db.commit()
