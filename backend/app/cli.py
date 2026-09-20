import argparse
from sqlalchemy import select
from .database import Base, SessionLocal, engine
from .models import User
from .security import code_digest, hash_code


def create_superadmin(full_name: str, public_code: str, login_code: str):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.public_code == public_code)):
            raise SystemExit("این کد عمومی قبلاً استفاده شده است")
        if db.scalar(select(User).where(User.login_code_digest == code_digest(login_code))):
            raise SystemExit("این رمز عضویت قبلاً استفاده شده است")
        user = User(
            public_code=public_code,
            login_code_digest=code_digest(login_code),
            login_code_hash=hash_code(login_code),
            full_name=full_name,
            first_name=full_name.split()[0],
            role="superadmin",
        )
        db.add(user)
        db.commit()
        print(f"سوپرادمین {full_name} ساخته شد")


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-superadmin")
    create.add_argument("--name", required=True)
    create.add_argument("--public-code", required=True)
    create.add_argument("--login-code", required=True)
    args = parser.parse_args()
    if args.command == "create-superadmin":
        create_superadmin(args.name, args.public_code, args.login_code)


if __name__ == "__main__":
    main()
