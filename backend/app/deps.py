from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from jwt import InvalidTokenError
from .database import get_db
from .models import User
from .security import decode_token


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ورود به حساب الزامی است")
    try:
        payload = decode_token(authorization[7:])
        user = db.get(User, int(payload["sub"]))
    except (InvalidTokenError, KeyError, ValueError):
        user = None
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "نشست معتبر نیست")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "superadmin"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "دسترسی مدیر لازم است")
    return user


def superadmin_user(user: User = Depends(current_user)) -> User:
    if user.role != "superadmin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "دسترسی سوپرادمین لازم است")
    return user
