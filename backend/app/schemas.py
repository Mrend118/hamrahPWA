from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    code: str = Field(min_length=4, max_length=64)


class SessionStartIn(BaseModel):
    subjectId: int


class SessionActionIn(BaseModel):
    sessionId: int


class SessionSaveIn(BaseModel):
    sessionId: int
    subjectId: int | None = None
    note: str | None = Field(default=None, max_length=1000)


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    studentId: int | None = None


class UserCreateIn(BaseModel):
    fullName: str = Field(min_length=2, max_length=160)
    firstName: str | None = Field(default=None, max_length=80)
    publicCode: str | None = Field(default=None, max_length=32)
    role: str = "student"
    grade: str | None = Field(default=None, max_length=100)
    level: int = Field(default=1, ge=1, le=100)
    groupId: int | None = None
    consultantId: int | None = None
    loginCode: str | None = Field(default=None, min_length=4, max_length=64)


class UserUpdateIn(BaseModel):
    fullName: str | None = Field(default=None, min_length=2, max_length=160)
    firstName: str | None = Field(default=None, max_length=80)
    grade: str | None = Field(default=None, max_length=100)
    level: int | None = Field(default=None, ge=1, le=100)
    groupId: int | None = None
    consultantId: int | None = None
    isActive: bool | None = None
    role: str | None = None
    resetLoginCode: bool = False
    newLoginCode: str | None = Field(default=None, min_length=6, max_length=64)


class GroupIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class SubjectIn(BaseModel):
    title: str = Field(min_length=2, max_length=100)


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    body: str = Field(min_length=2, max_length=5000)
    tone: str = "info"
    imageUrl: str | None = Field(default=None, max_length=500)
    targetGroupId: int | None = None


class AnnouncementUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=180)
    body: str | None = Field(default=None, min_length=2, max_length=5000)
    tone: str | None = None
    imageUrl: str | None = Field(default=None, max_length=500)
    targetGroupId: int | None = None
    isActive: bool | None = None


class ProfileChangeRequestIn(BaseModel):
    fullName: str = Field(min_length=2, max_length=160)
