import bcrypt
from sqlalchemy.orm import Session

from core.exceptions import ConflictError, ValidationError
from core.models import User
from core.logging import get_logger
from features.auth.repository import get_user_by_email, create_user
from infrastructure.auth.jwt import create_access_token

logger = get_logger(__name__)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def register_user(db: Session, email: str, display_name: str, password: str) -> User:

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
    user = get_user_by_email(db, email)

    if not user or not verify_password(password, user.password_hash):
        raise ValidationError("Incorrect email or password")
    
    if not user.is_active:
        raise ValidationError("Account is disabled")
    
    return user


def issue_token(user: User) -> str:
    return create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "display_name": user.display_name},
    )
