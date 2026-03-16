"""Lightweight column migrations + init_db().

Runs idempotent ALTERs for columns added after the initial schema.
Called once at startup from main.py lifespan.
"""

from sqlalchemy import inspect, text

from core.database import engine, Base


def _migrate_add_columns() -> None:
    """Add columns introduced after initial schema (idempotent)."""
    insp = inspect(engine)
    if "projects" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("projects")}
        if "user_id" not in cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN user_id VARCHAR(36) REFERENCES users(id)"
                ))
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
    if "facets" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("facets")}
        if "suggested_label" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE facets ADD COLUMN suggested_label TEXT"))
        if "label_source" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE facets ADD COLUMN label_source TEXT DEFAULT 'auto'"))
        if "user_id" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE facets ADD COLUMN user_id VARCHAR(36) REFERENCES users(id)"))
    if "coded_segments" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("coded_segments")}
        for col_name in ("tsne_x", "tsne_y"):
            if col_name not in cols:
                with engine.begin() as conn:
                    conn.execute(text(
                        f"ALTER TABLE coded_segments ADD COLUMN {col_name} FLOAT"
                    ))


def _migrate_icr_resolutions() -> None:
    insp = inspect(engine)
    if "icr_resolutions" not in insp.get_table_names():
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE icr_resolutions (
                    id VARCHAR(36) PRIMARY KEY,
                    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    document_id VARCHAR(36) REFERENCES documents(id) ON DELETE SET NULL,
                    span_start INTEGER NOT NULL,
                    span_end INTEGER NOT NULL,
                    disagreement_type VARCHAR(50) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'unresolved',
                    chosen_segment_id VARCHAR(36) REFERENCES coded_segments(id) ON DELETE SET NULL,
                    resolved_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
                    resolution_note TEXT,
                    llm_analysis TEXT,
                    created_at DATETIME,
                    resolved_at DATETIME
                )
            """))


def init_db() -> None:
    import core.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_add_columns()
    _migrate_icr_resolutions()
