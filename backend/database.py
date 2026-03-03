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
    enabled_perspectives = Column(JSON, default=lambda: ["self_consistency"])
    thresholds_json = Column(JSON, nullable=True)
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
    consistency_scores = relationship("ConsistencyScore", back_populates="segment", cascade="all, delete-orphan")


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


class EditEvent(Base):
    """Audit trail for code/segment mutations — powers the Edit History view."""
    __tablename__ = "edit_events"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    entity_type = Column(String, nullable=False)      # "segment" | "code"
    action = Column(String, nullable=False)            # "created" | "updated" | "deleted"
    entity_id = Column(String, nullable=False)
    field_changed = Column(String, nullable=True)      # e.g. "label", "definition", "colour"
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)        # snapshot context
    user_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ConsistencyScore(Base):
    """
    Append-only scoring record — one per coded segment.
    Contains both Stage 1 (deterministic) and Stage 2 (LLM) scores.
    Used for evaluation: export and compute kappa, precision/recall, drift.
    """
    __tablename__ = "consistency_scores"

    id = Column(String, primary_key=True)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=False)
    code_id = Column(String, ForeignKey("codes.id"), nullable=False)
    user_id = Column(String, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)

    # Stage 1: Deterministic (reproducible, no LLM)
    centroid_similarity = Column(Float, nullable=True)      # cosine(segment, code_centroid) [0,1]
    is_pseudo_centroid = Column(Boolean, default=False)       # cold-start fallback used?
    proposed_code_prob = Column(Float, nullable=True)        # P(proposed_code) from softmax [0,1]
    entropy = Column(Float, nullable=True)                   # normalised Shannon entropy [0,1]
    conflict_score = Column(Float, nullable=True)            # 1 - proposed_code_prob [0,1]
    temporal_drift = Column(Float, nullable=True)            # centroid drift for this code [0,1]
    codebook_distribution = Column(JSON, nullable=True)      # full {code: probability} dict

    # Stage 2: LLM-produced (grounded on Stage 1)
    llm_consistency_score = Column(Float, nullable=True)     # [0.0–1.0]
    llm_intent_score = Column(Float, nullable=True)          # [0.0–1.0]
    llm_conflict_severity = Column(Float, nullable=True)     # [0.0–1.0]
    llm_overall_severity = Column(Float, nullable=True)      # [0.0–1.0]
    llm_predicted_code = Column(String, nullable=True)       # inter-rater top prediction
    llm_predicted_confidence = Column(Float, nullable=True)  # [0.0–1.0]
    llm_predicted_codes_json = Column(JSON, nullable=True)   # ranked list [{code, confidence, reasoning}]

    # Stage 3: Escalation metadata
    was_escalated = Column(Boolean, default=False)
    escalation_reason = Column(String, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    segment = relationship("CodedSegment", back_populates="consistency_scores")



def _migrate_add_columns():
    """Add columns introduced after initial schema (idempotent)."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    if "projects" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("projects")}
        if "enabled_perspectives" not in cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN enabled_perspectives JSON DEFAULT '[]'"
                ))
        if "thresholds_json" not in cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN thresholds_json JSON"
                ))
    if "consistency_scores" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("consistency_scores")}
        if "llm_predicted_codes_json" not in cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE consistency_scores ADD COLUMN llm_predicted_codes_json JSON"
                ))


def init_db():
    """Create all tables and run lightweight migrations."""
    Base.metadata.create_all(bind=engine)
    _migrate_add_columns()


def get_db():
    """FastAPI dependency: yields a DB session then closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
