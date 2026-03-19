"""
Auth Pydantic schemas
"""
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    """Payload for POST /api/auth/register."""
    email: EmailStr
    display_name: str
    password: str


class LoginRequest(BaseModel):
    """Payload for POST /api/auth/login."""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Public user representation returned to the client."""
    user_id: str
    email: str
    display_name: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Response body for both /register and /login.

    Returns the JWT alongside the user so the frontend can cache both
    in a single response without a follow-up /me call.
    """
    access_token: str
    token_type: str = "bearer"
    user: UserOut
