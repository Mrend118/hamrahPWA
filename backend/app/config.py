import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / "backend" / ".env")


class Settings:
    env = os.getenv("APP_ENV", "development")
    database_url = os.getenv("DATABASE_URL", "sqlite:///./hamrah.db")
    secret_key = os.getenv("SECRET_KEY", "dev-only-change-me")
    login_pepper = os.getenv("LOGIN_PEPPER", "dev-login-pepper-change-me")
    access_token_minutes = int(os.getenv("ACCESS_TOKEN_MINUTES", "720"))
    min_session_seconds = int(os.getenv("MIN_SESSION_SECONDS", "5"))
    cors_origins = [
        value.strip()
        for value in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if value.strip()
    ]
    seed_demo = os.getenv("SEED_DEMO", "true").lower() == "true"


settings = Settings()
