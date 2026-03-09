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
        # Feature 6: Reflection loop columns
        for col_name, col_default in [
            ("initial_consistency_score", "NULL"),
            ("initial_intent_score", "NULL"),
            ("initial_severity_score", "NULL"),
            ("was_reflected", "0"),
            ("was_challenged", "0"),
        ]:
            if col_name not in cols:
                col_type = "FLOAT" if "score" in col_name else "BOOLEAN DEFAULT 0"
                with engine.begin() as conn:
                    conn.execute(text(
                        f"ALTER TABLE consistency_scores ADD COLUMN {col_name} {col_type}"
                    ))
    if "facets" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("facets")}
        if "suggested_label" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE facets ADD COLUMN suggested_label TEXT"))
        if "label_source" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE facets ADD COLUMN label_source TEXT DEFAULT 'auto'"))
    if "coded_segments" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("coded_segments")}
        for col_name in ("tsne_x", "tsne_y"):
            if col_name not in cols:
                with engine.begin() as conn:
                    conn.execute(text(
                        f"ALTER TABLE coded_segments ADD COLUMN {col_name} FLOAT"
                    ))


def init_db() -> None:
    import core.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_add_columns()
