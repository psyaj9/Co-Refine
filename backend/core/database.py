"""
SQLAlchemy engine, session factory, and declarative base.

Everything database related that is shared across the whole app starts here.
Feature modules import `Base` to define their models, and routers depend on
`get_db()` via FastAPI's Depends() to get a scoped session per request.
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
    """FastAPI dependency that yields a database session for the duration of a request.

    The finally block ensures the session is always closed, even if the handler raises.
    Usage: `db: Session = Depends(get_db)` in any router function.

    Yields:
        Session: A SQLAlchemy session bound to the request lifecycle.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
