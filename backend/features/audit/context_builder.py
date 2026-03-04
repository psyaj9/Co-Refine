"""Context builder utilities for audit feature."""
from __future__ import annotations

from sqlalchemy.orm import Session

from core.models import AnalysisResult, Code


def extract_window(full_text: str, start: int, end: int, sentences: int = 2) -> str:
    """Extract a windowed context string around a text span."""
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
    """Build {code_label: {definition, lens}} from AnalysisResult rows."""
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
    """Build {code_label: user_definition} from Code rows."""
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    return {c.label: (c.definition or "") for c in codes}
