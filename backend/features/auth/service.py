"""
Auth service — user registration, password verification, and token issuance.

"""
import bcrypt
from sqlalchemy.orm import Session

from core.exceptions import ConflictError, ValidationError
from core.models import User
from core.logging import get_logger
from features.auth.repository import get_user_by_email, create_user
from infrastructure.auth.jwt import create_access_token

logger = get_logger(__name__)


def hash_password(plain: str) -> str:
    """Hash a password with bcrypt.

    Args:
        plain: The raw password string from the registration form.

    Returns:
        A bcrypt hash string suitable for storing in the DB.
    """

    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Check password against a stored bcrypt hash.

    Args:
        plain: The password the user just typed.
        hashed: The stored bcrypt hash from the DB.

    Returns:
        True if they match, False otherwise.
    """
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def register_user(db: Session, email: str, display_name: str, password: str) -> User:
    """Create a new user account.

    Raises ConflictError (→ 409) if an account already exists for this email.

    Args:
        db: Active SQLAlchemy session.
        email: The new user's email address.
        display_name: How their name appears in the UI.
        password: Password that gets hashed before storage.

    Returns:
        The newly created and persisted User ORM object.

    Raises:
        ConflictError: If the email is already registered.
    """
    if get_user_by_email(db, email):
        raise ConflictError("An account with that email already exists")

    user = User(
        email=email.lower(),
        display_name=display_name,
        password_hash=hash_password(password),
    )

    created = create_user(db, user)
    logger.info("User registered", extra={"user_id": created.id, "email": created.email})

    return created


def authenticate_user(db: Session, email: str, password: str) -> User:
    """Verify credentials and return the authenticated user.

    Args:
        db: Active SQLAlchemy session.
        email: The email the user entered at login.
        password: The password to check.

    Returns:
        The authenticated User ORM object.

    Raises:
        ValidationError: If credentials are wrong or the account is disabled.
    """
    user = get_user_by_email(db, email)

    if not user or not verify_password(password, user.password_hash):
        raise ValidationError("Incorrect email or password")

    if not user.is_active:
        raise ValidationError("Account is disabled")

    return user


def issue_token(user: User) -> str:
    """Create a signed JWT for a given user.

    Embeds email and display_name as extra claims so the frontend can
    bootstrap session state from the token without an extra /me call.

    Args:
        user: The authenticated User ORM object.

    Returns:
        A signed JWT string.
    """
    return create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "display_name": user.display_name},
    )
