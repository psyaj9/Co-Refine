"""SQLAlchemy engine, session factory, and declarative base.

This module owns ONLY the connection infrastructure.
ORM models live in core/models/*.py.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session then closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
