import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from a2wsgi import ASGIMiddleware
from backend.app.config import settings
from backend.app.database import Base, SessionLocal, engine
from backend.app.main import app
from backend.app.seed import seed

Base.metadata.create_all(engine)
if settings.seed_demo:
    with SessionLocal() as db:
        seed(db)

application = ASGIMiddleware(app)
