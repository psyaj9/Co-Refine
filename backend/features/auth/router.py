"""
Auth router - register, login, and /me endpoints.

"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.exceptions import ConflictError, ValidationError
from core.models import User
from features.auth.schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut
from features.auth.service import register_user, authenticate_user, issue_token
from infrastructure.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    """Convert an ORM User to the UserOut schema.

    Args:
        user: SQLAlchemy User model instance.

    Returns:
        UserOut Pydantic model with only the fields safe to send to the client.
    """
    return UserOut(user_id=user.id, email=user.email, display_name=user.display_name)


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new account and immediately return a JWT so the user is logged in.

    Args:
        body: Email, display name, and password.
        db: DB session.

    Returns:
        TokenResponse with access_token and user info.

    Raises:
        409 if an account with that email already exists.
    """
    try:
        user = register_user(db, body.email, body.display_name, body.password)
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=exc.message)
    token = issue_token(user)
    return TokenResponse(access_token=token, user=_user_out(user))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate with email and password, return a JWT.

    Args:
        body: Email and password.
        db: DB session.

    Returns:
        TokenResponse with access_token and user info.

    Raises:
        401 if credentials are wrong or the account is disabled.
    """
    try:
        user = authenticate_user(db, body.email, body.password)

    except ValidationError as exc:
        raise HTTPException(status_code=401, detail=exc.message)
    token = issue_token(user)

    return TokenResponse(access_token=token, user=_user_out(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile.

    Used by the frontend on startup to verify the stored token is still valid and to restore session state.

    Args:
        current_user: Injected from the JWT via get_current_user dependency.

    Returns:
        UserOut with user_id, email, and display_name.
    """
    return _user_out(current_user)
