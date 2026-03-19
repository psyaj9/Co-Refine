"""
User ORM model.

Represents a registered researcher account. 
Authentication is JWT-based, on login the user gets a signed token containing their user_id, which is then used to scope all queries.

Passwords are never stored in plain text, password_hash holds a bcrypt digest.
The is_active flag lets admins disable accounts without deleting their data.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.orm import relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")
