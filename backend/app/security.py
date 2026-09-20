import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
import jwt
from .config import settings


def code_digest(code: str) -> str:
    return hmac.new(settings.login_pepper.encode(), code.encode(), hashlib.sha256).hexdigest()


def hash_code(code: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(code.encode(), salt=salt, n=16384, r=8, p=1)
    return f"{salt.hex()}${digest.hex()}"


def verify_code(code: str, encoded: str) -> bool:
    try:
        salt_hex, expected = encoded.split("$", 1)
        actual = hashlib.scrypt(code.encode(), salt=bytes.fromhex(salt_hex), n=16384, r=8, p=1).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "role": role, "iat": now, "exp": now + timedelta(minutes=settings.access_token_minutes)}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=["HS256"])


def generate_login_code(length: int = 8) -> str:
    return "".join(secrets.choice("23456789") for _ in range(length))
