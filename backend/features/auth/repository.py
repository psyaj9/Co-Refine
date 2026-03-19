"""
Auth repository — thin DB access layer for user records.

Deliberately minimal: just lookup-by-email and insert. The service layer
handles all business logic (hashing, conflict checks, etc.).
"""
from sqlalchemy.orm import Session

from core.models import User


def get_user_by_email(db: Session, email: str) -> User | None:
    """Look up a user by email address (case-insensitive, normalised to lowercase).

    Args:
        db: Active SQLAlchemy session.
        email: Email to search for.

    Returns:
        The matching User ORM object, or None if no account exists.
    """
    # Emails are stored lowercase so we match case-insensitively without ILIKE
    return db.query(User).filter(User.email == email.lower()).first()


def create_user(db: Session, user: User) -> User:
    """Persist a new User record and return it with DB-generated fields populated.

    Args:
        db: Active SQLAlchemy session.
        user: Fully-constructed User ORM object (id, email, password_hash already set).

    Returns:
        The same User object after commit + refresh (so created_at etc. are populated).
    """
    db.add(user)
    db.commit()
    # Refresh so the caller gets the final DB state (timestamps, defaults, etc.)
    db.refresh(user)
    return user
