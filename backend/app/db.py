from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool
from .config import settings

sqlite_options = {}
if settings.database_url.startswith("sqlite"):
    sqlite_options["connect_args"] = {"check_same_thread": False}
    if ":memory:" in settings.database_url or settings.database_url.endswith("sqlite://"):
        sqlite_options["poolclass"] = StaticPool

engine = create_engine(settings.database_url, pool_pre_ping=True, **sqlite_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
