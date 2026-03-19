"""Helper functions for making the context that is fed into audit prompts.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from core.models import AnalysisResult, Code


def extract_window(full_text: str, start: int, end: int, sentences: int = 2) -> str:
    """Pull some sentences of context around a highlighted span.

    The highlighted text is wrapped in `>>>...<<<` markers so the LLM can clearly identify the target quote. 
    Before and after context is separated by `...` ellipses.

    Args:
        full_text: The entire document text.
        start: Character offset where the coded segment begins.
        end: Character offset where the coded segment ends.
        sentences: How many sentences of context to include on each side.

    Returns:
        A formatted string like:
        ``"...prev sentence. >>>highlighted text<<< next sentence..."``
    """
    before = full_text[:start]
    after = full_text[end:]

    before_parts = before.replace("?", ".").replace("!", ".").split(".")
    before_context = ".".join(before_parts[-sentences:]).strip() if before_parts else ""

    after_parts = after.replace("?", ".").replace("!", ".").split(".")
    after_context = ".".join(after_parts[:sentences]).strip() if after_parts else ""

    highlight = full_text[start:end]
    parts = []
    if before_context:
        parts.append(f"...{before_context}")
    parts.append(f">>>{highlight}<<<")
    if after_context:
        parts.append(f"{after_context}...")
    return " ".join(parts)


def build_code_definitions(db: Session, project_id: str) -> dict[str, dict]:
    """Build a codebook from AI-generated analysis results for a project.

    Only codes that have been through the analysis pipeline are included. 
    This is the codebook that contains both the AI definition and the theoretical lens.

    Args:
        db: Active SQLAlchemy session.
        project_id: The project to scope the query to.

    Returns:
        Dict mapping code label → {"definition": str, "lens": str}.
        Empty strings for missing fields rather than None, so prompt
        templates can format them without extra None checks.
    """
    return {
        code.label: {"definition": a.definition or "", "lens": a.lens or ""}
        for a, code in (
            db.query(AnalysisResult, Code)
            .join(Code, AnalysisResult.code_id == Code.id)
            .filter(Code.project_id == project_id)
            .all()
        )
    }


def build_user_code_definitions(db: Session, project_id: str) -> dict[str, str]:
    """Build a  codebook from user code definitions.

    Pulls the raw user-authored definition field directly off the Code model.
    Used as a fallback when no AnalysisResult exists yet, and also passed to the audit prompt so the LLM knows the researcher's own framing.

    Args:
        db: Active SQLAlchemy session.
        project_id: The project to scope the query to.

    Returns:
        Dict mapping code label → definition string (empty string if unset).
    """
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    return {c.label: (c.definition or "") for c in codes}
