from sqlalchemy import (
    create_engine, Column, String, Text, Integer, Float,
    DateTime, Boolean, ForeignKey, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timezone

from config import settings

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()



class Project(Base):
    """A project groups documents and codes together."""
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    codes = relationship("Code", back_populates="project", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    full_text = Column(Text, nullable=False)
    doc_type = Column(String, default="transcript")
    html_content = Column(Text, nullable=True)
    original_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="documents")
    segments = relationship("CodedSegment", back_populates="document", cascade="all, delete-orphan")


class Code(Base):
    __tablename__ = "codes"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    label = Column(String, nullable=False)
    definition = Column(Text, nullable=True)
    colour = Column(String, default="#FFEB3B")
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="codes")
    segments = relationship("CodedSegment", back_populates="code", cascade="all, delete-orphan")
    analyses = relationship("AnalysisResult", back_populates="code", cascade="all, delete-orphan")


class CodedSegment(Base):
    __tablename__ = "coded_segments"

    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    text = Column(Text, nullable=False)
    start_index = Column(Integer, nullable=False)
    end_index = Column(Integer, nullable=False)
    code_id = Column(String, ForeignKey("codes.id"), nullable=False)
    user_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship("Document", back_populates="segments")
    code = relationship("Code", back_populates="segments")
    alerts = relationship("AgentAlert", back_populates="segment", cascade="all, delete-orphan")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(String, primary_key=True)
    code_id = Column(String, ForeignKey("codes.id"), nullable=False)
    definition = Column(Text, nullable=True)
    lens = Column(Text, nullable=True)
    reasoning = Column(Text, nullable=True)
    segment_count_at_analysis = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    code = relationship("Code", back_populates="analyses")


class AgentAlert(Base):
    """Persisted AI agent alerts so the frontend can fetch missed ones."""
    __tablename__ = "agent_alerts"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=True)
    alert_type = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    segment = relationship("CodedSegment", back_populates="alerts")


class ChatMessage(Base):
    """Persisted chat messages for AI chat conversations."""
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))



def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency: yields a DB session then closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
