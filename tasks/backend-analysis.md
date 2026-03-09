# Backend Codebase Analysis Report

> **Purpose**: Comprehensive pre-refactoring audit of all Python files in `backend/`.  
> **Date**: Generated after reading all 113 Python files across the `backend/` tree.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [File Inventory](#2-file-inventory)
3. [Architecture: Active vs Legacy Paths](#3-architecture-active-vs-legacy-paths)
4. [Problem Catalogue](#4-problem-catalogue)
5. [Duplication Map](#5-duplication-map)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Dependency Graph](#7-dependency-graph)
8. [Files Not In Original List / Anomalies](#8-files-not-in-original-list--anomalies)
9. [Recommended Refactoring Actions](#9-recommended-refactoring-actions)

---

## 1. Executive Summary

The backend is in a **dual-track architectural state**: a feature-sliced architecture (`features/`) has been built and is the active path wired into `main.py`, while an older flat architecture (`routers/`, `services/`, root-level `models.py`, `config.py`, `database.py`) still exists but is **never mounted** by the running application.

**The active application flow is:**  
`main.py` → `features/*/router.py` → `features/*/service.py` → `features/*/repository.py` + `infrastructure/*`

**The legacy code is completely dead** (`routers/`, most of `services/`, `backend/models.py`) but continues to import actively-maintained infrastructure, creating maintenance confusion and preventing safe deletion without analysis.

### Key Risk Areas
- **Two non-existent files** are referenced in architecture docs: `features/audit/challenge_handler.py` and `features/facets/repository.py` — this means the challenge feature is either in the legacy router or unimplemented.
- **`prompts/__init__.py`** exports `build_reflection_prompt` and `build_challenge_prompt` in `__all__` but never imports them — any `from prompts import build_reflection_prompt` would raise `ImportError`.
- **`services/audit_pipeline.py`** calls `run_coding_audit(..., enable_reflection=False)` but `ai_analyzer.py`'s `run_coding_audit` has no such parameter — **`TypeError` at runtime if ever activated**.
- **`cosine_similarity()`** is defined in three separate files.
- `core/exceptions.py` defines a full domain exception hierarchy that is **used nowhere** — every router raises `HTTPException` directly.

---

## 2. File Inventory

### Legend
| Status | Meaning |
|--------|---------|
| `ACTIVE` | Live code, called by the running application |
| `LEGACY` | Not mounted / not imported by any active code path |
| `SHIM` | Re-exports only; wraps another module |
| `DEAD` | Never imported anywhere in any code path |
| `MISSING` | Referenced in docs/imports but file does not exist |
| `EMPTY` | Effectively blank (comment or `pass` only) |

---

### `backend/` (root-level)

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| `main.py` | 65 | ACTIVE | FastAPI app factory; registers features/ routers, CORS, WebSocket, calls `init_db()` on startup |
| `config.py` | 3 | SHIM | Re-exports `Settings`, `settings`, `get_threshold` from `core.config` |
| `database.py` | 22 | SHIM | Re-exports engine, SessionLocal, Base, get_db, all ORM models from `core.*` |
| `models.py` | ~80 | LEGACY | Original Pydantic DTO monolith: `ProjectCreate`, `ProjectOut`, `DocumentOut`, `CodeCreate/Out/Update`, `SegmentCreate/Out`, `BatchSegmentCreate`, `AlertOut`, `ChatRequest`, `ChatMessageOut`, `AnalysisOut`, `AnalysisTrigger`, `BatchAuditRequest`, `EditEventOut`, `ChallengeReflectionRequest/Response`, `ChallengeMeta` — all used only by `routers/` |
| `requirements.txt` | — | ACTIVE | Python dependencies |

---

### `backend/core/`

| File | Lines | Status | Purpose / Notable Issues |
|------|-------|--------|--------------------------|
| `config.py` | 42 | ACTIVE | Pydantic `BaseSettings` singleton; `Settings` class, `settings`, `get_threshold()`. **Issue**: `consistency_escalation_threshold` referenced in `features/projects/constants.py` is not defined as a field — `get_threshold()` silently returns `None` via `getattr`. |
| `database.py` | 25 | ACTIVE | SQLAlchemy engine, `SessionLocal`, `Base`, `get_db()` FastAPI dependency |
| `events.py` | 35 | ACTIVE | 19 WebSocket event type string constants (`AGENTS_STARTED`, `CODING_AUDIT`, etc.). **Issue**: `features/audit/orchestrator.py` uses inline string literals instead of these constants, largely defeating the purpose. |
| `exceptions.py` | 28 | DEAD | Domain exception hierarchy: `DomainError`, `NotFoundError`, `ValidationError`, `ConflictError`, `ExternalServiceError`. **Not imported or raised anywhere** — all error handling uses `HTTPException` directly. |
| `logging.py` | 26 | ACTIVE | `get_logger(name)` factory returning a structured `logging.Logger`. Used by features/ and infrastructure/. |
| `__init__.py` | 1 | ACTIVE | Empty package init |

---

### `backend/core/models/`

| File | Lines | Status | Key Fields / Issues |
|------|-------|--------|---------------------|
| `__init__.py` | 34 | ACTIVE | Re-exports all 12 ORM model classes to guarantee SQLAlchemy relationship resolution |
| `project.py` | ~25 | ACTIVE | `Project`: id (UUID str), name, enabled_perspectives (JSON), thresholds_json (JSON), created_at |
| `document.py` | ~25 | ACTIVE | `Document`: id, project_id (FK), title, full_text, doc_type, html_content, original_filename, created_at |
| `code.py` | ~25 | ACTIVE | `Code`: id, project_id (FK), label, definition, colour, created_by, created_at |
| `segment.py` | ~35 | ACTIVE | `CodedSegment`: id, document_id (FK), text, start_index, end_index, code_id (FK), user_id, created_at, tsne_x, tsne_y; relationships to 5 child tables |
| `analysis.py` | ~20 | ACTIVE | `AnalysisResult`: id, code_id (FK), definition, lens, reasoning, segment_count_at_analysis, created_at |
| `alert.py` | ~25 | ACTIVE | `AgentAlert`: id, user_id, segment_id (FK, nullable), alert_type, payload (JSON), is_read, created_at |
| `chat.py` | ~20 | ACTIVE | `ChatMessage`: id, conversation_id (indexed), project_id (FK), user_id, role, content, created_at. **Issue**: No SQLAlchemy `relationship` to `Project` — FK exists but no ORM navigation. |
| `edit_event.py` | ~25 | ACTIVE | `EditEvent`: full audit trail — entity_type, action, entity_id, field_changed, old_value, new_value, metadata_json, user_id |
| `consistency_score.py` | ~55 | ACTIVE | `ConsistencyScore`: Append-only audit record — Stage 1 (centroid_similarity, is_pseudo_centroid, temporal_drift), Stage 2 LLM scores, reflection loop columns, escalation metadata |
| `human_feedback.py` | ~30 | ACTIVE | `HumanFeedback`: feedback_type, feedback_text, context_json, result_json |
| `facet.py` | ~45 | ACTIVE | `Facet`: KMeans cluster per code — label, suggested_label, label_source, centroid_json, segment_count, is_active. `FacetAssignment`: segment_id → facet_id, similarity_score, is_dominant |
| `migrations.py` | ~75 | ACTIVE | Idempotent `ALTER TABLE` migrations + `init_db()`. **Issue**: Uses raw SQL strings with f-string interpolation for column type definitions — minor SQL injection surface (internal only, but bad pattern). |

---

### `backend/features/projects/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `router.py` | ~110 | ACTIVE | CRUD + settings + threshold endpoints. **Issue**: `DELETE /{id}` handler directly imports and calls `infrastructure.vector_store.store` inside a try/except inside the route — business logic leaking into router. |
| `schemas.py` | ~25 | ACTIVE | `ProjectCreate`, `ProjectOut`, `ProjectSettingsOut`, `ProjectSettingsUpdate` |
| `service.py` | ~35 | ACTIVE | `project_to_out()`, `get_merged_thresholds()`, `build_settings_out()` |
| `repository.py` | ~55 | ACTIVE | `get_project_by_id`, `list_all_projects`, `create_project`, `delete_project`, `update_project`, `batch_project_counts`, `get_segment_ids_for_project`. **Issue**: `get_segment_ids_for_project` uses deferred `from core.models import CodedSegment` inside function body — unnecessary and surprising. |
| `constants.py` | ~20 | ACTIVE | `AVAILABLE_PERSPECTIVES` list, `THRESHOLD_DEFINITIONS` list of 7 dicts. References `consistency_escalation_threshold` which is not a defined `Settings` field. |

---

### `backend/features/documents/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `router.py` | ~120 | ACTIVE | Upload, paste, list, get, delete. **Issue**: Constructs `Document` ORM object inline in route handler — should be in service; HTML extraction logic also in route. |
| `schemas.py` | ~20 | ACTIVE | `DocumentUploadResponse`, `DocumentOut` |
| `service.py` | ~30 | ACTIVE | `normalise_text()`, `cleanup_document_vectors()` — deferred vector store import inside try/except |
| `repository.py` | ~30 | ACTIVE | `get_document_by_id`, `list_documents`, `create_document`, `delete_document`, `get_segments_for_document` |
| `file_parser.py` | ~70 | ACTIVE | `extract_text()`, `extract_html()`. **Issue**: `_extract_docx_text` and `_extract_pdf_text` use bare `except Exception: return None` — parse failures are silently swallowed. **Duplicate** of `backend/utils/file_parser.py`. |

---

### `backend/features/codes/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `router.py` | ~100 | ACTIVE | CRUD. Module-level `_code_to_out()` helper should be in service layer. |
| `schemas.py` | ~40 | ACTIVE | `CodeCreate`, `CodeOut`, `CodeUpdate`, `SegmentOut` |
| `service.py` | ~55 | ACTIVE | `record_code_event()`, `cascade_delete_code()` — deferred vector store import inside try/except |
| `repository.py` | ~50 | ACTIVE | `get_code_by_id`, `get_code_by_label_and_project`, `list_codes`, `create_code`, `update_code`, `delete_code_record`, `segment_counts`, `get_segments_for_code` |

---

### `backend/features/segments/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `router.py` | ~230 | ACTIVE | **Largest features router** (~230 lines); CRUD + batch + alerts. **Issues**: constructs `CodedSegment` ORM object inline; triggers two different background tasks; has deferred imports inside route handlers; contains business logic (overlap detection, edit-event construction). Violates single-responsibility — should be split. |
| `schemas.py` | ~40 | ACTIVE | `SegmentCreate`, `SegmentOut`, `BatchSegmentCreate`, `AlertOut` |
| `service.py` | ~45 | ACTIVE | `record_segment_event()` only — thin |
| `repository.py` | ~50 | ACTIVE | `get_segment_by_id`, `list_segments`, `create_segment`, `delete_segment_record`, `get_code_for_segment`, `get_document`, `list_alerts` |

---

### `backend/features/audit/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `router.py` | ~80 | ACTIVE | `/analyze`, `/analyses`, `/batch-audit`. **Issue**: Contains inline DB query logic in route handlers (`db.query(Code)...`, `db.query(CodedSegment).count()`). |
| `schemas.py` | ~20 | ACTIVE | `AnalysisOut`, `AnalysisTrigger`, `BatchAuditRequest` |
| `orchestrator.py` | ~175 | ACTIVE | `run_background_agents()`: per-segment audit pipeline. **Issues**: monolithic 150-line function; uses inline string literals (`"agents_started"`) instead of `core.events` constants; calls `services.ai_analyzer` (cross-layer coupling from features/ → services/); heavy nested try/except. |
| `batch_auditor.py` | ~150 | ACTIVE | `run_batch_audit_background()`. **Issue**: Duplicate of `services/audit_pipeline.py::_run_batch_audit_background()` (dead legacy). |
| `auto_analyzer.py` | ~100 | ACTIVE | `run_manual_analysis()`, `maybe_run_auto_analysis()`. **Issue**: Duplicate of functions in `services/audit_pipeline.py`. |
| `sibling_auditor.py` | ~100 | ACTIVE | `reaudit_siblings()`, `reaudit_siblings_background()`. **Issue**: Duplicate of `services/audit_pipeline.py::_reaudit_siblings()`. |
| `score_persister.py` | ~70 | ACTIVE | `persist_agent_alert()`, `persist_consistency_score()` — well-scoped. **Issue**: `ConsistencyScore.llm_conflict_severity` field exists in the model but is never populated here. |
| `context_builder.py` | ~45 | ACTIVE | `extract_window()`, `build_code_definitions()`, `build_user_code_definitions()` |
| `challenge_handler.py` | — | **MISSING** | File does not exist. Referenced in architecture docs. Challenge handling falls back to legacy `routers/segments/challenge.py` (which calls the dead `services/ai_analyzer::run_challenge_cycle` and `services/audit_pipeline::_ws_send`). |

---

### `backend/features/scoring/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `pipeline.py` | ~35 | ACTIVE | `compute_stage1_scores()` orchestrator. **Duplicate** of `services/scoring.py::compute_stage1_scores()`. |
| `centroid.py` | ~75 | ACTIVE | `cosine_similarity()`, centroid computation, `segment_to_centroid_similarity()`. **Duplicate** of functions in `services/scoring.py`. `cosine_similarity` is also defined in `infrastructure/vector_store/mmr.py`. |
| `temporal_drift.py` | ~40 | ACTIVE | `compute_temporal_drift()`. **Duplicate** of `services/scoring.py`. |
| `code_overlap.py` | ~35 | ACTIVE | `compute_code_overlap_matrix()`. **Duplicate** of `services/scoring.py`. |
| `distribution.py` | 1 | DEAD | Contains only `# Codebook probability distribution scoring removed.` — effectively empty; should be deleted. |

---

### `backend/features/chat/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `router.py` | ~100 | ACTIVE | Send, history, conversations, delete. |
| `schemas.py` | ~20 | ACTIVE | `ChatRequest`, `ChatMessageOut` |
| `service.py` | ~115 | ACTIVE | `build_codebook()`, `retrieve_segments()`, `stream_response_background()`. **Issue**: `build_codebook()` fires 3 separate queries per code in a loop (N+1 pattern). |
| `repository.py` | ~50 | ACTIVE | `get_conversation_messages`, `create_message`, `delete_conversation_messages`, `list_conversation_stubs`, `get_first_user_message` |

---

### `backend/features/facets/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `service.py` | ~150 | ACTIVE | `run_facet_analysis()`, `suggest_facet_labels()`, `_compute_optimal_k()`, `_compute_tsne()`, `_get_embeddings_by_ids()`. **Issues**: missing repository layer — service performs all DB writes directly; bare `except Exception: return {}` in `_get_embeddings_by_ids`; duplicate of `services/facet_clustering.py`. |
| `repository.py` | — | **MISSING** | File does not exist. Facet DB operations are inlined in `service.py`. |

---

### `backend/features/visualisations/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `router.py` | ~90 | ACTIVE | Overview, facets, consistency, overlap, relabel, suggest-labels, explain. **Issue**: `get_code_overlap` hardcodes `user_id="default"` — no user scoping. |
| `schemas.py` | ~5 | ACTIVE | `RelabelFacetBody` |
| `service.py` | ~250 | ACTIVE | **God service** (~250 lines); `get_overview()`, `get_facets()`, `get_consistency()`, `get_code_overlap()`, `explain_facet()`. **Issues**: `get_overview()` ~80 lines computing stats in Python loops where SQL aggregation would be faster; `explain_facet()` calls `call_llm()` directly (bypasses service layer abstraction); multiple concerns in one file. |

---

### `backend/features/edit_history/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `router.py` | ~40 | ACTIVE | `GET /{project_id}/edit-history` with filters |
| `schemas.py` | ~20 | ACTIVE | `EditEventOut` |
| `repository.py` | ~25 | ACTIVE | `get_edit_history()` with optional filters |

---

### `backend/infrastructure/llm/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `client.py` | ~70 | ACTIVE | `get_client()` lazy singleton, `call_llm()` with retry. **Issue**: contains `print(f"[LLM] Parse failure...")` — should use structured logger. |
| `json_parser.py` | ~70 | ACTIVE | `parse_json_response()` with multiple fallback strategies (direct, markdown fence, pattern extraction, `<think>` block stripping) |

---

### `backend/infrastructure/vector_store/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `embeddings.py` | ~35 | ACTIVE | `embed_text()`, lazy API client. **Issue**: No error handling on Azure embedding API call — network/auth failures will propagate as unhandled exceptions. |
| `store.py` | ~120 | ACTIVE | ChromaDB CRUD: `get_collection()`, `add_segment_embedding()`, `find_similar_segments()`, `delete_segment_embedding()`, `get_all_segments_for_code()`, `get_segment_count()`. **Issue**: `delete_segment_embedding` has bare `except Exception: pass` — silent failure on delete. |
| `mmr.py` | ~80 | ACTIVE | `cosine_similarity()`, `find_diverse_segments()` (MMR algorithm). **Issue**: Defines its own `cosine_similarity()` — 3rd copy in the codebase. |

---

### `backend/infrastructure/websocket/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `manager.py` | ~60 | ACTIVE | `ConnectionManager` class, `ws_manager` singleton, `send_alert_threadsafe()` using `asyncio.run_coroutine_threadsafe`. |

---

### `backend/prompts/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `__init__.py` | ~12 | ACTIVE | Imports `build_analysis_prompt`, `build_coding_audit_prompt`, `build_chat_messages`. **Issue**: `__all__` also lists `build_reflection_prompt` and `build_challenge_prompt` which are **never imported** — `ImportError` if accessed via `from prompts import build_reflection_prompt`. |
| `analysis_prompt.py` | ~50 | ACTIVE | `ANALYSIS_PROMPT_TEMPLATE`, `build_analysis_prompt()` |
| `audit_prompt.py` | ~200 | ACTIVE | `build_coding_audit_prompt()`, system + user templates, evidence section builder. Largest prompt file. |
| `chat_prompt.py` | ~60 | ACTIVE | `CHAT_SYSTEM_PROMPT`, `build_chat_messages()` |
| `facet_label_prompt.py` | ~55 | ACTIVE | `build_facet_label_prompt()` |

---

### `backend/services/` (legacy)

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `ai_analyzer.py` | ~100 | ACTIVE\* | `analyze_quotes()`, `run_coding_audit()`, `stream_chat_response()`, `run_challenge_cycle()`. Called by `features/audit/orchestrator.py` and legacy `routers/`. **Issue**: `run_challenge_cycle` exists here but there is no `features/audit/challenge_handler.py` — so challenge is only accessible via the legacy (unmounted) router. |
| `audit_pipeline.py` | ~400 | LEGACY | Large god-file: `_run_background_agents()`, `_run_analysis_background()`, `_run_batch_audit_background()`, `_reaudit_siblings_background()`, `_ws_send()`, etc. **Critical Issues**: calls `run_coding_audit(..., enable_reflection=False)` but that parameter doesn't exist → **TypeError** if activated; ~8 `print()` calls; completely duplicates `features/audit/`; not imported by any active code path. |
| `facet_clustering.py` | ~100 | LEGACY | Duplicate of `features/facets/service.py`; uses `services.vector_store` shim. Not called by active code. |
| `scoring.py` | ~250 | LEGACY | Full duplicate of `features/scoring/*` — all centroid, temporal drift, code overlap, and pipeline logic. Not called by active code. |
| `vector_store.py` | ~17 | SHIM | Re-exports `add_segment_embedding`, `find_similar_segments`, `delete_segment_embedding`, `get_all_segments_for_code`, `get_segment_count`, `find_diverse_segments` from `infrastructure.vector_store.*`. Referenced by legacy `routers/`. |
| `ws_manager.py` | ~4 | SHIM | Re-exports `ws_manager` from `infrastructure.websocket.manager`. Referenced by legacy `routers/`. |

\* `services/ai_analyzer.py` is ACTIVE because `features/audit/orchestrator.py` imports it directly — a layering violation.

---

### `backend/routers/` (legacy — not mounted)

**None of these are imported by `main.py`.** The entire `routers/` package is unmounted legacy code. They import from `backend/models.py`, `services/`, and `utils/`.

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `__init__.py` | ~1 | LEGACY | Empty |
| `projects.py` | ~110 | LEGACY | Imports `from models import ...` (root-level Pydantic monolith) |
| `documents.py` | ~50 | LEGACY | Imports `from utils.file_parser import ...`; uses `services.vector_store` |
| `codes.py` | ~50 | LEGACY | Imports `from models import CodeCreate, CodeOut, ...` |
| `chat.py` | ~50 | LEGACY | Imports `from services.ai_analyzer import stream_chat_response` — correctly references active service |
| `vis.py` | ~50 | LEGACY | Large inline stats computation mimicking `features/visualisations/service.py` |
| `edit_history.py` | ~40 | LEGACY | Imports `from models import EditEventOut` |
| `evaluation.py` | ~8 | LEGACY | Placeholder — one commented-out note, no actual routes |
| `segments/__init__.py` | ~15 | LEGACY | Assembles 4 sub-routers into `/api/segments` |
| `segments/crud.py` | ~80 | LEGACY | Calls `services/audit_pipeline._run_background_agents`, `_reaudit_siblings_background`, `_extract_window` |
| `segments/alerts.py` | ~40 | LEGACY | Self-contained alert CRUD (doesn't call legacy services) |
| `segments/analysis.py` | ~80 | LEGACY | Calls `services/audit_pipeline._run_analysis_background`, `_run_batch_audit_background` |
| `segments/challenge.py` | ~80 | LEGACY | Calls `services/ai_analyzer.run_challenge_cycle`, `services/audit_pipeline._ws_send`, `services/vector_store.find_diverse_segments` |

---

### `backend/utils/`

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `__init__.py` | ~1 | LEGACY | Empty package init |
| `file_parser.py` | ~65 | LEGACY | `extract_text()`, `extract_html()`, `_extract_docx_text()`, `_extract_pdf_text()`. **Exact duplicate** of `features/documents/file_parser.py`. Used by `routers/documents.py` (legacy only). |

---

## 3. Architecture: Active vs Legacy Paths

```
=== ACTIVE (mounted in main.py) ===

HTTP Request
    └── main.py (lifespan, CORS, WS endpoint)
        ├── features/projects/router.py
        ├── features/documents/router.py
        ├── features/codes/router.py
        ├── features/segments/router.py   ← God router: ~230 lines
        ├── features/audit/router.py
        ├── features/chat/router.py
        ├── features/visualisations/router.py
        └── features/edit_history/router.py

Each features/X/router.py calls:
    └── features/X/service.py
        ├── features/X/repository.py  (DB queries via SessionLocal)
        └── infrastructure/
            ├── llm/client.py        (Azure OpenAI)
            ├── vector_store/store.py (ChromaDB)
            └── websocket/manager.py (WS broadcast)

Background tasks (per-segment audit) call:
    features/audit/orchestrator.py
        └── services/ai_analyzer.py  ← LAYERING VIOLATION (features → services)
            └── infrastructure/llm/client.py
                └── prompts/audit_prompt.py


=== LEGACY (not mounted — dead code) ===

routers/
    └── uses: backend/models.py (Pydantic DTOs)
              services/audit_pipeline.py  (god file)
              services/vector_store.py    (shim)
              services/ws_manager.py      (shim)
              utils/file_parser.py        (duplicate)
```

### Key layering violation
`features/audit/orchestrator.py` imports from `services/ai_analyzer.py`. The audit feature should either:
1. Move `run_coding_audit` + `run_challenge_cycle` into `features/audit/` directly, or
2. Move them to `infrastructure/llm/` as LLM operations

---

## 4. Problem Catalogue

### P0 — Critical Bugs

| ID | File | Problem |
|----|------|---------|
| P0-1 | `services/audit_pipeline.py` | Calls `run_coding_audit(..., enable_reflection=False)` but `ai_analyzer.py::run_coding_audit` has no `enable_reflection` parameter → **`TypeError` at runtime** if legacy router is ever activated |
| P0-2 | `prompts/__init__.py` | Exports `build_reflection_prompt` and `build_challenge_prompt` in `__all__` but never imports them → **`ImportError`** on access |
| P0-3 | `features/audit/challenge_handler.py` | **File does not exist** — challenge handling is only available through the unmounted legacy router; the feature is effectively dead in the new architecture |
| P0-4 | `features/facets/repository.py` | **File does not exist** — facets service directly performs all DB writes with no repository layer |

---

### P1 — God Files / Single-Responsibility Violations

| ID | File | Lines | Problem |
|----|------|-------|---------|
| P1-1 | `services/audit_pipeline.py` | ~400 | Mixes: per-segment audit, batch audit, sibling re-audit, analysis trigger, WebSocket sending, scoring orchestration |
| P1-2 | `features/visualisations/service.py` | ~250 | Mixes: overview stats, facet explorer, consistency aggregation, code overlap, LLM facet explanation — 5 independent concerns |
| P1-3 | `services/scoring.py` | ~250 | Duplicate of entire `features/scoring/` module |
| P1-4 | `features/segments/router.py` | ~230 | Router doing ORM construction, overlap detection, edit-event recording, two background task dispatches AND query logic — far exceeds router responsibility |
| P1-5 | `features/audit/orchestrator.py` | ~175 | Single 150-line function `run_background_agents` doing embed → Stage1 → Stage2 → persist → emit — should delegate to named sub-functions or separate modules |
| P1-6 | `features/chat/service.py` | ~115 | `build_codebook()` has N+1 query pattern (1 + N×3 queries) |
| P1-7 | `features/facets/service.py` | ~150 | Missing repository layer — all DB writes inlined in service |

---

### P2 — Duplication (see also Section 5)

| ID | Problem |
|----|---------|
| P2-1 | `cosine_similarity()` defined in 3 files |
| P2-2 | Entire scoring module duplicated between `features/scoring/` and `services/scoring.py` |
| P2-3 | Batch audit logic duplicated between `features/audit/batch_auditor.py` and `services/audit_pipeline.py` |
| P2-4 | Facet clustering duplicated between `features/facets/service.py` and `services/facet_clustering.py` |
| P2-5 | File parser duplicated between `features/documents/file_parser.py` and `utils/file_parser.py` |
| P2-6 | Pydantic DTOs partially duplicated between `features/*/schemas.py` files and root `models.py` |

---

### P3 — Logging / Observability

| ID | File | Problem |
|----|------|---------|
| P3-1 | `services/audit_pipeline.py` | ~8 `print()` calls: `print("[Agent] Analysis parse failure...")`, `print("[Agent] Batch audit fatal error...")`, etc. |
| P3-2 | `infrastructure/llm/client.py` | 1 `print()` on parse failure |
| P3-3 | `features/audit/orchestrator.py` | Uses `core.events` constants inconsistently — inline strings like `"agents_started"` instead of `ev.AGENTS_STARTED` |

---

### P4 — Error Handling

| ID | File | Problem |
|----|------|---------|
| P4-1 | `core/exceptions.py` | Entire domain exception hierarchy is dead — nothing imports it. All error handling is `raise HTTPException(...)` directly in routers. |
| P4-2 | `features/documents/file_parser.py` | `_extract_docx_text` and `_extract_pdf_text` use bare `except Exception: return None` — parse errors silently swallowed |
| P4-3 | `infrastructure/vector_store/store.py` | `delete_segment_embedding` swallows all exceptions with `except Exception: pass` — delete failures are invisible |
| P4-4 | `features/facets/service.py` | `_get_embeddings_by_ids` uses bare `except Exception: return {}` — all embedding failures become empty results |
| P4-5 | `features/documents/service.py`, `codes/service.py` | Deferred vector store imports inside `try/except ImportError` — fragile pattern; if import fails during runtime, the error is silently swallowed at call time |
| P4-6 | `features/audit/orchestrator.py` | Deep nested try/except without logging context (segment_id, code_label) before re-raises |

---

### P5 — Coupling / Boundary Violations

| ID | Problem |
|----|---------|
| P5-1 | `features/audit/orchestrator.py` imports from `services/ai_analyzer.py` — `features/` layer must not depend on `services/` layer |
| P5-2 | `features/visualisations/service.py` calls `call_llm()` directly from `infrastructure/llm/client.py` without going through any LLM service abstraction |
| P5-3 | `features/projects/router.py` imports `infrastructure.vector_store.store` directly in a route handler (delete endpoint) |
| P5-4 | `features/segments/router.py` constructs `CodedSegment` and `EditEvent` ORM objects inline instead of delegating to service |
| P5-5 | `features/documents/router.py` constructs `Document` ORM object inline and calls `extract_html()` inline |
| P5-6 | `features/audit/router.py` performs `db.query(Code)...` and `db.query(CodedSegment).count()` inline — DB queries belong in repository |

---

### P6 — Missing / Incomplete Features

| ID | Problem |
|----|---------|
| P6-1 | No authentication or authorization anywhere — `user_id` is passed as a query string parameter or form field, never verified |
| P6-2 | `features/visualisations/router.py` hardcodes `user_id="default"` for code overlap endpoint |
| P6-3 | `ConsistencyScore.llm_conflict_severity` field exists in the model but is never populated by `score_persister.py` |
| P6-4 | `features/scoring/distribution.py` — referenced module but contains only a deletion comment. If anything imports it expecting functions, it will fail. |
| P6-5 | `ChatMessage` has no SQLAlchemy `relationship` to `Project` despite the FK — navigation from Project to messages is impossible via ORM |

---

### P7 — Minor / Code Quality

| ID | Problem |
|----|---------|
| P7-1 | `core/models/migrations.py` uses f-string interpolation to build SQL `ALTER TABLE` statements — even though column types are hardcoded strings, this pattern is dangerous to extend |
| P7-2 | `features/projects/constants.py` references `consistency_escalation_threshold` but `core/config.py::Settings` has no such field — `get_threshold("consistency_escalation_threshold")` silently returns `None` |
| P7-3 | `features/projects/repository.py::get_segment_ids_for_project` has deferred `from core.models import CodedSegment` inside function body |
| P7-4 | `infrastructure/vector_store/embeddings.py` has no error handling on Azure embedding API call |
| P7-5 | `features/chat/service.py::build_codebook` has N+1 query pattern — queries analysis and segment count for each code separately |

---

## 5. Duplication Map

```
cosine_similarity()
├── features/scoring/centroid.py          [ACTIVE]
├── infrastructure/vector_store/mmr.py    [ACTIVE]
└── services/scoring.py                   [LEGACY — delete]

_compute_centroid() / get_code_centroid()
├── features/scoring/centroid.py          [ACTIVE]
└── services/scoring.py                   [LEGACY — delete]

compute_temporal_drift()
├── features/scoring/temporal_drift.py   [ACTIVE]
└── services/scoring.py                   [LEGACY — delete]

compute_code_overlap_matrix()
├── features/scoring/code_overlap.py     [ACTIVE]
└── services/scoring.py                   [LEGACY — delete]

compute_stage1_scores()
├── features/scoring/pipeline.py         [ACTIVE]
└── services/scoring.py                   [LEGACY — delete]

run_facet_analysis()
├── features/facets/service.py           [ACTIVE]
└── services/facet_clustering.py         [LEGACY — delete]

_extract_window() / extract_window()
├── features/audit/context_builder.py   [ACTIVE]
└── services/audit_pipeline.py           [LEGACY — delete]

batch_audit logic
├── features/audit/batch_auditor.py     [ACTIVE]
└── services/audit_pipeline.py           [LEGACY — delete]

file_parser (extract_text, extract_html)
├── features/documents/file_parser.py   [ACTIVE]
└── utils/file_parser.py                 [LEGACY — delete]

Pydantic DTOs
├── features/*/schemas.py               [ACTIVE]
└── backend/models.py                    [LEGACY — delete once routers/ is removed]
```

---

## 6. Cross-Cutting Concerns

### 6.1 Logging

| Layer | Practice | Status |
|-------|----------|--------|
| `features/*` | `get_logger(__name__)` from `core/logging.py` ✓ | Correct |
| `infrastructure/*` | `get_logger(__name__)` from `core/logging.py` ✓ | Correct (except one `print()` in `llm/client.py`) |
| `services/audit_pipeline.py` | `print()` — ~8 calls | Must be fixed before any reactivation |
| `services/*` other | Mixed | Legacy; delete entire `services/` after migration |

### 6.2 Error Handling

Three inconsistent strategies are in use simultaneously:

1. **Features routers**: `raise HTTPException(status_code=...)` directly
2. **Domain exceptions** (`core/exceptions.py`): Defined but used **nowhere**
3. **Background task exceptions**: Caught locally with bare `except Exception` and logged (or swallowed silently)

**The intended pattern** (domain exceptions → caught in router and mapped to HTTP) is fully stubbed but not wired. Until `core/exceptions.py` is actually raised by services and caught by routers, the exception hierarchy provides zero value.

### 6.3 WebSocket Event Constants

`core/events.py` defines 19 event type constants. Usage is inconsistent:

| File | Uses `core.events` constants | Uses inline strings |
|------|------------------------------|---------------------|
| `features/audit/orchestrator.py` | No | Yes (all events) |
| `features/audit/batch_auditor.py` | Partial | Partial |
| `features/audit/auto_analyzer.py` | No | Yes |
| `features/audit/sibling_auditor.py` | No | Yes |
| `infrastructure/websocket/manager.py` | N/A | N/A |

Every event string in the above files should be replaced with the constant from `core.events`.

### 6.4 Authentication / Authorization

- **None**. There is no authentication middleware, API key validation on endpoints, or session management.
- `user_id` is accepted as a query parameter or form field on many endpoints and passed straight through to DB records.
- This is consistent with a dissertation prototype scope but is documented here as a gap.

### 6.5 Database Session Management

| Context | Pattern | Status |
|---------|---------|--------|
| Request-scoped | `get_db()` via `Depends` | Correct |
| Background tasks | `SessionLocal()` with `try/finally` close | Correct |
| Inline router logic | ORM operations without going through repository | Needs refactoring |

---

## 7. Dependency Graph

```
main.py
  ├── core.database (get_db, init_db)
  ├── infrastructure.websocket.manager (ws_manager, WebSocket)
  ├── core.config (settings)
  └── features/*/router  [8 routers]

features/projects/router
  ├── features/projects/service
  ├── features/projects/repository
  ├── features/projects/schemas
  ├── features/projects/constants
  ├── core.database (get_db)
  └── infrastructure.vector_store.store  [← direct in delete handler]

features/documents/router
  ├── features/documents/service
  ├── features/documents/repository
  ├── features/documents/file_parser
  └── features/documents/schemas

features/codes/router
  ├── features/codes/service
  ├── features/codes/repository
  └── features/codes/schemas

features/segments/router
  ├── features/segments/service
  ├── features/segments/repository
  ├── features/segments/schemas
  ├── features/audit/orchestrator        [background task]
  ├── features/audit/sibling_auditor     [background task]
  └── infrastructure.vector_store.store  [← direct on delete]

features/audit/router
  ├── features/audit/auto_analyzer
  ├── features/audit/batch_auditor
  ├── features/audit/schemas
  ├── core.models
  └── core.database

features/audit/orchestrator
  ├── features/audit/score_persister
  ├── features/audit/context_builder
  ├── features/scoring/pipeline          [Stage 1]
  ├── services/ai_analyzer               [← LAYERING VIOLATION]
  ├── infrastructure.vector_store.store
  ├── infrastructure.vector_store.embeddings
  ├── infrastructure.websocket.manager
  └── core.events (partially)

services/ai_analyzer
  ├── infrastructure.llm.client (call_llm)
  └── prompts (build_coding_audit_prompt, build_analysis_prompt)

features/scoring/pipeline
  ├── features/scoring/centroid
  ├── features/scoring/temporal_drift
  └── infrastructure.vector_store.store

features/chat/router
  ├── features/chat/service
  ├── features/chat/repository
  └── features/chat/schemas

features/chat/service
  ├── features/chat/repository
  ├── infrastructure.vector_store.store
  ├── infrastructure.websocket.manager
  ├── infrastructure.llm.client
  └── prompts.chat_prompt

features/facets/service
  ├── infrastructure.vector_store.store
  ├── infrastructure.vector_store.embeddings
  ├── infrastructure.llm.client
  └── prompts.facet_label_prompt
  [no repository layer]

features/visualisations/service
  ├── core.models (direct DB queries)
  ├── features/facets/service            [← cross-feature import — FORBIDDEN]
  ├── infrastructure.llm.client          [← direct, bypasses service abstraction]
  └── infrastructure.websocket.manager

infrastructure.llm.client
  └── infrastructure.llm.json_parser

infrastructure.vector_store.store
  └── infrastructure.vector_store.embeddings

prompts/__init__
  ├── prompts/analysis_prompt
  ├── prompts/audit_prompt
  └── prompts/chat_prompt
  [missing: reflection_prompt, challenge_prompt — in __all__ but not imported]
```

---

## 8. Files Not In Original List / Anomalies

The following files exist that were not in the original analysis list or reveal anomalies:

| Finding | Detail |
|---------|--------|
| `backend/config.py` | Root-level SHIM wrapping `core.config` — exists for backwards compat with old import paths |
| `backend/database.py` | Root-level SHIM re-exporting all of `core.database` + all 12 ORM models + `init_db` |
| `backend/models.py` | Root-level Pydantic DTO monolith with 15 schema classes — only referenced by `routers/` (legacy) |
| `backend/utils/file_parser.py` | Exact duplicate of `features/documents/file_parser.py` — only referenced by `routers/documents.py` (legacy) |
| `backend/routers/segments/challenge.py` | Contains the only active implementation of `run_challenge_cycle` (via `services/ai_analyzer.py`) but the router that would mount it is not mounted in `main.py` |
| `features/audit/challenge_handler.py` | Does NOT exist — architecture docs list it but the file was never created |
| `features/facets/repository.py` | Does NOT exist despite being listed in architecture docs |
| `features/scoring/distribution.py` | Exists but contains only a deletion comment |
| `prompts/__init__.py` | `__all__` names two functions (`build_reflection_prompt`, `build_challenge_prompt`) that are neither defined nor imported anywhere in the prompts package |

---

## 9. Recommended Refactoring Actions

Ordered by impact and safety (easiest + highest value first).

### Phase 1: Safe Deletions (zero risk)

These files are confirmed dead — no active code path imports them. Delete cleanly.

```
backend/services/audit_pipeline.py    # God file, dead, has TypeError bug
backend/services/facet_clustering.py  # Dead duplicate
backend/services/scoring.py           # Dead duplicate
backend/services/vector_store.py      # Dead shim
backend/services/ws_manager.py        # Dead shim
backend/utils/file_parser.py          # Dead duplicate (only used by dead routers/)
backend/utils/__init__.py             # Dead (empty)
backend/routers/                      # Entire directory (not mounted)
backend/models.py                     # Dead Pydantic monolith (only used by routers/)
backend/config.py                     # Shim only; update remaining callers to use core.config
backend/database.py                   # Shim only; update callers to use core.database
features/scoring/distribution.py      # 1-line deletion comment
```

**Before deleting**, verify with `grep -r "from services" backend/` and `grep -r "from routers" backend/` to confirm no active imports remain.

### Phase 2: Fix Critical Bugs

1. **`prompts/__init__.py`**: Remove `build_reflection_prompt` and `build_challenge_prompt` from `__all__` until they exist; or create stub functions that raise `NotImplementedError`.

2. **`features/audit/challenge_handler.py`**: Create this file by migrating `run_challenge_cycle` from `services/ai_analyzer.py` into a proper `features/audit/` module, then wire it into `features/audit/router.py`.

3. **`features/facets/repository.py`**: Create and extract all DB operations from `features/facets/service.py`.

4. **`ConsistencyScore.llm_conflict_severity`**: Either populate it in `score_persister.py` or remove the column.

### Phase 3: Fix Layering Violations

1. **Move `run_coding_audit()` out of `services/ai_analyzer.py`**:  
   - Move it to `features/audit/segment_auditor.py` (or similar)
   - This eliminates the `features/ → services/` import in `orchestrator.py`
   - Move `stream_chat_response()` to `features/chat/service.py`
   - `services/ai_analyzer.py` can then be deleted

2. **`features/visualisations/service.py`**: Replace the direct `call_llm()` call with a proper service-layer method.

3. **`features/visualisations/service.py` imports `features/facets/service.py`**: Move shared facet-retrieval functions to a location both can access (shared repository query or lift to `core/`).

### Phase 4: Router Cleanup

1. **`features/segments/router.py`** (~230 lines): Extract `CodedSegment` + `EditEvent` construction into `features/segments/service.py`. Extract overlap detection into a repository helper. Target: router under 100 lines.

2. **`features/documents/router.py`**: Move `Document` construction and `extract_html()` call into `features/documents/service.py`.

3. **`features/audit/router.py`**: Move the inline `db.query(Code)` and `db.query(CodedSegment).count()` into `features/audit/` repository calls.

4. **`features/projects/router.py`**: Move vector store cleanup on delete into `features/projects/service.py`.

### Phase 5: Wire Domain Exceptions

1. Add `raise NotFoundError(...)` in repository functions where `None` is returned for missing resources.
2. Add exception-to-HTTP mapping in each `router.py` (`except NotFoundError: raise HTTPException(404, ...)`).
3. This enables testing controller logic without HTTP layer.

### Phase 6: Consolidate Utilities

1. **`cosine_similarity()`**: Keep one canonical copy in `infrastructure/vector_store/mmr.py` (or `features/scoring/centroid.py`) and import elsewhere.

2. **`features/chat/service.py::build_codebook`**: Replace N+1 loop with a single `JOIN` query in `features/chat/repository.py`.

3. **`features/audit/orchestrator.py`**: Replace inline event string literals with `core.events.*` constants throughout.

4. **`infrastructure/llm/client.py`**: Replace `print()` with `logger.warning()`.

### Phase 7: Add Missing Fields / Relationships

1. Add `ChatMessage` → `Project` SQLAlchemy relationship.
2. Add `consistency_escalation_threshold` to `core/config.py::Settings` or remove the reference in `constants.py`.
3. Populate `ConsistencyScore.llm_conflict_severity` in `score_persister.py`.

---

*End of report. Total backend Python files analyzed: 113.*
