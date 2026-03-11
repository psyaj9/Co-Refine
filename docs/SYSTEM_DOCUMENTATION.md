# Co-Refine: Full System Documentation

> Comprehensive technical documentation for dissertation purposes.
> Generated: 2026-03-10

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Backend Architecture](#3-backend-architecture)
   - 3.1 [Application Entry Point](#31-application-entry-point)
   - 3.2 [Configuration & Settings](#32-configuration--settings)
   - 3.3 [Database & ORM Models](#33-database--orm-models)
   - 3.4 [Domain Exceptions](#34-domain-exceptions)
   - 3.5 [WebSocket Event System](#35-websocket-event-system)
   - 3.6 [Infrastructure Layer](#36-infrastructure-layer)
   - 3.7 [Feature: Projects](#37-feature-projects)
   - 3.8 [Feature: Documents](#38-feature-documents)
   - 3.9 [Feature: Codes](#39-feature-codes)
   - 3.10 [Feature: Segments](#310-feature-segments)
   - 3.11 [Feature: Audit Pipeline](#311-feature-audit-pipeline)
   - 3.12 [Feature: Scoring (Deterministic)](#312-feature-scoring-deterministic)
   - 3.13 [Feature: Chat](#313-feature-chat)
   - 3.14 [Feature: Facets](#314-feature-facets)
   - 3.15 [Feature: Visualisations](#315-feature-visualisations)
   - 3.16 [Feature: Edit History](#316-feature-edit-history)
   - 3.17 [Feature: ICR (Inter-Coder Reliability)](#317-feature-icr-inter-coder-reliability)
   - 3.18 [Prompt Engineering](#318-prompt-engineering)
4. [Frontend Architecture](#4-frontend-architecture)
   - 4.1 [Technology Stack](#41-technology-stack)
   - 4.2 [Folder Structure & Layer Boundaries](#42-folder-structure--layer-boundaries)
   - 4.3 [Root Application Shell](#43-root-application-shell)
   - 4.4 [Zustand State Management](#44-zustand-state-management)
   - 4.5 [API Client](#45-api-client)
   - 4.6 [WebSocket Client Hook](#46-websocket-client-hook)
   - 4.7 [TypeScript Type System](#47-typescript-type-system)
   - 4.8 [Feature: Audit UI](#48-feature-audit-ui)
   - 4.9 [Feature: Chat UI](#49-feature-chat-ui)
   - 4.10 [Feature: Documents UI](#410-feature-documents-ui)
   - 4.11 [Feature: Codes UI](#411-feature-codes-ui)
   - 4.12 [Feature: Selection & Highlight Popover](#412-feature-selection--highlight-popover)
   - 4.13 [Feature: Visualisations UI](#413-feature-visualisations-ui)
   - 4.14 [Feature: Edit History UI](#414-feature-edit-history-ui)
   - 4.15 [Feature: Project Settings](#415-feature-project-settings)
   - 4.16 [Feature: ICR UI](#416-feature-icr-ui)
   - 4.17 [Widgets](#417-widgets)
   - 4.18 [Shared Utilities & Libraries](#418-shared-utilities--libraries)
5. [Data Flow & Integration](#5-data-flow--integration)
   - 5.1 [Segment Creation & Audit Flow](#51-segment-creation--audit-flow)
   - 5.2 [Real-Time WebSocket Event Flow](#52-real-time-websocket-event-flow)
   - 5.3 [Batch Audit Flow](#53-batch-audit-flow)
   - 5.4 [Chat Message Flow](#54-chat-message-flow)
6. [API Endpoint Reference](#6-api-endpoint-reference)
7. [Key Algorithms & AI Components](#7-key-algorithms--ai-components)
   - 7.1 [3-Stage Audit Pipeline](#71-3-stage-audit-pipeline)
   - 7.2 [Centroid Similarity](#72-centroid-similarity)
   - 7.3 [Temporal Drift Detection](#73-temporal-drift-detection)
   - 7.4 [Code Overlap Detection](#74-code-overlap-detection)
   - 7.5 [Facet Clustering (KMeans + t-SNE)](#75-facet-clustering-kmeans--t-sne)
   - 7.6 [Inter-Coder Reliability Metrics](#76-inter-coder-reliability-metrics)
8. [Design Decisions & Rationale](#8-design-decisions--rationale)
9. [Security & Authentication](#9-security--authentication)
10. [Accessibility](#10-accessibility)
11. [Testing Strategy](#11-testing-strategy)

---

## 1. System Overview

**Co-Refine** is a web-based qualitative research coding tool designed to assist researchers in applying, managing, and auditing qualitative codes on text documents. It addresses a core challenge in qualitative research: maintaining coding consistency and intent across a large corpus of coded segments.

### Core Problem Domain

In qualitative research, coding involves assigning thematic labels ("codes") to segments of text. Researchers must:
- Apply codes consistently across documents
- Maintain clear definitional boundaries between codes
- Detect when their understanding of a code has drifted over time
- Identify ambiguous or overlapping codes in their codebook

Co-Refine augments this process with an AI-powered two-stage audit pipeline that provides real-time feedback on each coding decision, surfacing consistency warnings, intent misalignments, and temporal drift patterns.

### Core Features

| Feature | Description |
|---------|-------------|
| **Document Management** | Upload PDF, DOCX, or plain text documents; paste raw text |
| **Codebook Management** | Create and manage qualitative codes with definitions and colour assignments |
| **Text Selection & Coding** | Highlight text spans and assign codes via floating popover |
| **2-Stage Audit Pipeline** | Automatic consistency checking on every code application |
| **Batch Audit** | Review consistency across all codes in the project |
| **AI Chat** | Conversational AI interface with project context awareness |
| **Visualisations** | Interactive dashboards: KPI overview, facet scatter plots, consistency timelines, code overlap heatmaps, co-occurrence matrices |
| **Edit History** | Full audit trail of all coding decisions |
| **Inter-Coder Reliability (ICR)** | Multi-coder comparison, kappa statistics, disagreement resolution |
| **Project Collaboration** | Invite coders to projects; role-based access (owner/coder) |

### Technology Stack Summary

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript 5.7, Zustand v5, Tailwind CSS 3, Radix UI, Recharts, Vite 6 |
| **Backend** | FastAPI (Python 3.12+), SQLAlchemy 2.x, Pydantic v2, SQLite |
| **AI/ML** | Azure OpenAI (GPT-5 fast + reasoning models), ChromaDB (vector store), SentenceTransformer (embeddings), scikit-learn (KMeans, t-SNE) |
| **Real-Time** | Native FastAPI WebSocket with thread-safe broadcasting |
| **Tests** | Vitest + React Testing Library + Playwright + axe-core (frontend); pytest (backend) |

---

## 2. Architecture Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │  Left Panel │  │ Main Panel  │  │       Right Panel        │ │
│  │ (Projects + │  │ (Documents/ │  │  (Alerts / Chat)         │ │
│  │  Codebook)  │  │  Vis / ICR) │  │                          │ │
│  └─────────────┘  └─────────────┘  └──────────────────────────┘ │
│                                                                  │
│     Zustand Store ←── WebSocket ──→ REST API calls              │
└──────────────────────────────────────────────────────────────────┘
                             │ HTTP + WebSocket
┌──────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND                           │
│                                                                  │
│  Routers (HTTP)          Services            Repositories        │
│  ┌───────────┐           ┌─────────┐         ┌──────────────┐   │
│  │ /api/*    │──────────▶│Business │────────▶│  SQLAlchemy  │   │
│  │ endpoints │           │  Logic  │         │  DB Queries  │   │
│  └───────────┘           └─────────┘         └──────────────┘   │
│        │                      │                      │           │
│  WebSocket /ws          Audit Pipeline          SQLite DB        │
│        │                      │                                  │
│  WS Manager ◀─── Background Threads ──▶ ChromaDB Vector Store   │
│                               │                                  │
│                         Azure OpenAI API                        │
└──────────────────────────────────────────────────────────────────┘
```

### Backend Layer Boundaries

The backend follows **vertical slices + clean architecture internals**:

```
features/X/router.py
    └── features/X/service.py
            ├── features/X/repository.py   (DB queries only)
            ├── infrastructure/*            (LLM, vector store, WS)
            ├── core/*                      (models, config, exceptions)
            └── prompts/*                   (prompt builders)

Strict rules:
  ✓ feature/A → core/, infrastructure/, prompts/
  ✗ feature/A → feature/B   (FORBIDDEN — lift to shared layer)
  ✗ core/* → features/*     (FORBIDDEN)

Exceptions:
  ✓ audit → scoring/         (single deliberate consumer)
  ✓ audit → facets/          (facet clustering triggered post-audit)
```

### Frontend Layer Boundaries

```
app/ → widgets/ → features/ → shared/
features/ → shared/     ✓ allowed
shared/ → features/     ✗ FORBIDDEN
features/A → features/B ✗ FORBIDDEN (use shared/ or lift to widgets/)
widgets/ → widgets/     ✗ FORBIDDEN
```

---

## 3. Backend Architecture

### 3.1 Application Entry Point

**File:** `backend/main.py`

The FastAPI application is created with a **lifespan context manager** that:
1. Calls `init_db()` to create/migrate all SQLAlchemy tables on startup
2. Sets the running asyncio event loop on the WebSocket manager (required for threadsafe `send_alert_threadsafe()` from background threads)

**CORS Configuration:** Allowed origins are configurable via `settings.allowed_origins` (list of strings from environment). This supports both local development (localhost:5173) and production deployments.

**Global Exception Handlers:**
| Domain Exception | HTTP Status Code |
|-----------------|-----------------|
| `NotFoundError` | 404 Not Found |
| `ValidationError` | 422 Unprocessable Entity |
| `ConflictError` | 409 Conflict |
| `ExternalServiceError` | 502 Bad Gateway |

**Registered Routers (all prefixed with `/api`):**
- `/auth` — Authentication
- `/projects` — Project management
- `/documents` — Document CRUD
- `/codes` — Codebook management
- `/segments` — Segment CRUD + audit triggers
- `/chat` — Conversational AI
- `/projects/{id}/edit-history` — Edit history
- `/projects/{id}/vis` — Visualisation data
- `/projects/{id}/icr` — Inter-coder reliability

**Special Endpoints:**
- `GET /api/health` — Health check
- `GET /api/settings` — Exposes configured model names + API key status (for UI display)
- `WebSocket /ws?token=<jwt>` — Real-time event stream; 4001 close code on auth failure

---

### 3.2 Configuration & Settings

**File:** `backend/core/config.py`

Pydantic `BaseSettings` class reads from `.env` file and environment variables. All settings have defaults suitable for development.

**Complete Settings Reference:**

| Setting Key | Type | Default | Description |
|-------------|------|---------|-------------|
| `jwt_secret` | str | auto-generated UUID | HMAC-SHA256 signing key for JWT tokens. Warns at startup if not explicitly set. |
| `access_token_expire_minutes` | int | 10,080 | Token validity window (7 days) |
| `azure_api_key` | str | "" | Azure OpenAI API key |
| `azure_endpoint` | str | "" | Azure OpenAI endpoint URL |
| `azure_deployment_fast` | str | "gpt-4o-mini" | Fast model deployment name |
| `azure_deployment_reasoning` | str | "o1-mini" | Reasoning model deployment name |
| `min_segments_for_consistency` | int | 3 | Minimum segments before centroid similarity is meaningful |
| `auto_analysis_threshold` | int | 3 | Segment count that triggers automatic code analysis |
| `drift_warning_threshold` | float | 0.3 | Temporal drift value above which a warning is emitted |
| `code_overlap_warning_threshold` | float | 0.85 | Cosine similarity above which codes are flagged as redundant |
| `database_url` | str | "sqlite:///./inductive_lens.db" | SQLite file path |
| `chroma_persist_dir` | str | "./chroma_data" | ChromaDB persistence directory |
| `allowed_origins` | list[str] | ["*"] | CORS origins whitelist |

**Helper Function:**
```python
get_threshold(key: str, project_thresholds: dict | None) -> float
```
Returns the project-level threshold override if set, otherwise falls back to the global setting. This allows per-project sensitivity tuning.

---

### 3.3 Database & ORM Models

**Files:** `backend/core/database.py`, `backend/core/models/`

**SQLAlchemy Setup:**
- Engine: `create_engine(database_url, connect_args={"check_same_thread": False})`
- Session factory: `SessionLocal` (non-autocommit, used via `get_db()` FastAPI dependency and direct context managers for background tasks)
- `init_db()` called at startup: creates all tables + runs lightweight column migrations for additive schema changes

**All primary keys are `String` (UUID) — never Integer.** This was a deliberate design choice for:
- Distributed-safe identifiers
- Avoiding ID enumeration attacks
- Consistent PK type across all relationships

#### Complete ORM Model Reference

**User**
```
id         String PK (UUID)
email      String, unique, indexed
display_name String
password_hash String
is_active  Boolean default True
created_at DateTime
```
Relationships: `memberships` → ProjectMember (one-to-many)

**Project**
```
id                    String PK (UUID)
name                  String
user_id               String FK → User.id
enabled_perspectives  JSON (list of perspective IDs)
thresholds_json       JSON (project-level threshold overrides)
created_at            DateTime
```
Relationships: `documents`, `codes`, `facets`, `members` (all cascade delete-orphan)

**Document**
```
id                String PK (UUID)
project_id        String FK → Project.id
title             String
full_text         Text
doc_type          String ("text" | "pdf" | "docx" | "html")
html_content      Text (nullable, rendered HTML for viewer)
original_filename String (nullable)
created_at        DateTime
```
Relationships: `segments` → CodedSegment (cascade delete-orphan)

**Code**
```
id         String PK (UUID)
project_id String FK → Project.id
label      String
definition Text (nullable)
colour     String (hex colour)
created_by String (user_id)
created_at DateTime
```
Relationships: `segments`, `analyses` (AnalysisResult), `facets` (Facet)
Constraint: unique(project_id, label)

**CodedSegment**
```
id          String PK (UUID)
document_id String FK → Document.id
code_id     String FK → Code.id
text        Text
start_index Integer
end_index   Integer
user_id     String FK → User.id
created_at  DateTime
tsne_x      Float (nullable) — 2D t-SNE x coordinate
tsne_y      Float (nullable) — 2D t-SNE y coordinate
```
Relationships: `code`, `document`, `alerts` (AgentAlert), `consistency_scores`, `facet_assignments`

**ConsistencyScore**
```
id                      String PK (UUID)
segment_id              String FK → CodedSegment.id (cascade delete)
code_id                 String FK → Code.id
project_id              String FK → Project.id
user_id                 String
centroid_similarity     Float (nullable)
is_pseudo_centroid      Boolean
temporal_drift          Float (nullable)
llm_consistency_score   Float (nullable)
llm_intent_score        Float (nullable)
llm_overall_severity    Float (nullable)
created_at              DateTime
```
This table is append-only — each audit creates a new row, enabling trend analysis over time.

**AgentAlert**
```
id         String PK (UUID)
user_id    String (indexed)
segment_id String FK → CodedSegment.id (nullable, SET NULL on delete)
alert_type String
payload    JSON
is_read    Boolean default False
created_at DateTime (indexed)
```

**AnalysisResult**
```
id                       String PK (UUID)
code_id                  String FK → Code.id (cascade delete)
definition               Text (AI-synthesised definition)
lens                     Text (AI-inferred analytical lens)
reasoning                Text (reasoning trace)
segment_count_at_analysis Integer
created_at               DateTime
```
Most-recent row per code_id is considered the "current" analysis.

**ChatMessage**
```
id              String PK (UUID)
conversation_id String (indexed)
project_id      String FK → Project.id
user_id         String
role            String ("user" | "assistant")
content         Text
created_at      DateTime
```

**EditEvent**
```
id            String PK (UUID)
project_id    String FK → Project.id (indexed)
document_id   String (nullable)
entity_type   String ("code" | "segment" | "project")
action        String ("create" | "update" | "delete")
entity_id     String
field_changed String (nullable, e.g. "label", "definition")
old_value     Text (nullable)
new_value     Text (nullable)
metadata_json JSON (nullable, extra context)
user_id       String
created_at    DateTime (indexed)
```

**Facet**
```
id             String PK (UUID)
code_id        String FK → Code.id (cascade delete)
project_id     String FK → Project.id
label          String (user-provided label, nullable)
suggested_label String (AI-suggested label)
label_source   String ("user" | "ai" | "default")
centroid_json  Text (JSON serialised centroid embedding)
segment_count  Integer
created_at     DateTime
updated_at     DateTime
is_active      Boolean default True
```
Relationships: `assignments` → FacetAssignment (cascade delete)

**FacetAssignment**
```
id               String PK (UUID)
segment_id       String FK → CodedSegment.id (cascade delete)
facet_id         String FK → Facet.id (cascade delete)
similarity_score Float
is_dominant      Boolean
assigned_at      DateTime
```

**ProjectMember**
```
project_id String FK (composite PK)
user_id    String FK (composite PK)
role       String ("owner" | "coder")
joined_at  DateTime
```

**IcrResolution**
```
id               String PK (UUID)
project_id       String FK
user_id          String
segment_id       String FK
code_id          String FK
resolving_code_id String FK (nullable)
resolution_type  String ("accept_code_a" | "accept_code_b" | "create_new" | "remove_both")
created_at       DateTime
```

---

### 3.4 Domain Exceptions

**File:** `backend/core/exceptions.py`

All domain exceptions extend `DomainError(Exception)` with a `.message` attribute. Routers catch these and map to HTTP status codes via the global exception handlers in `main.py`.

```python
class NotFoundError(DomainError): ...      # → 404
class ValidationError(DomainError): ...    # → 422
class ConflictError(DomainError): ...      # → 409
class ExternalServiceError(DomainError):   # → 502
```

Example usage: `raise NotFoundError(f"Project {project_id} not found")`

---

### 3.5 WebSocket Event System

**File:** `backend/core/events.py`

19 string constants for WebSocket event types, broadcast from background tasks to connected clients.

| Category | Event Constant | Purpose |
|----------|---------------|---------|
| **Agent lifecycle** | `AGENTS_STARTED` | Pipeline starts for a segment |
| | `AGENTS_DONE` | Pipeline complete for a segment |
| | `AGENT_THINKING` | Intermediate progress notification |
| | `AGENT_ERROR` | Pipeline error notification |
| **Scoring** | `DETERMINISTIC_SCORES` | Stage 1 scores ready |
| | `CODING_AUDIT` | LLM audit result ready |
| | `REFLECTION_COMPLETE` | Code analysis complete |
| | `CHALLENGE_RESULT` | Challenge response ready |
| **Analysis** | `ANALYSIS_UPDATED` | AnalysisResult updated |
| **Batch audit** | `BATCH_AUDIT_STARTED` | Batch operation begins |
| | `BATCH_AUDIT_PROGRESS` | Per-code progress update |
| | `BATCH_AUDIT_DONE` | Batch operation complete |
| **Code metrics** | `CODE_OVERLAP_MATRIX` | Pairwise code overlap computed |
| | `TEMPORAL_DRIFT_WARNING` | Drift threshold exceeded |
| **Facets** | `FACET_UPDATED` | Facet clustering updated |
| **Chat** | `CHAT_STREAM_START` | Streaming response begins |
| | `CHAT_TOKEN` | Individual token during streaming |
| | `CHAT_DONE` | Streaming complete |
| | `CHAT_ERROR` | Chat error |

---

### 3.6 Infrastructure Layer

#### LLM Client (`backend/infrastructure/llm/client.py`)

Wraps `AzureOpenAI` SDK as a singleton. All LLM calls go through:

```python
call_llm(
    prompt: str | list[dict],   # string or messages array
    model: str | None = None,   # deployment name override
    retries: int = 1            # retry count on parse failure
) -> dict
```

- Uses `response_format={"type": "json_object"}` for structured outputs
- On parse failure, returns `PARSE_FAILED_SENTINEL` dict
- `json_parser.py` contains `parse_json_response(text)` with fallback parsing logic

**Model Selection:**
- Default: `settings.azure_deployment_fast` (for consistency audits, analysis)
- Reasoning model: `settings.azure_deployment_reasoning` (for code definition synthesis)

#### Vector Store (`backend/infrastructure/vector_store/store.py`)

ChromaDB persistent client. Each user has a namespaced collection: `segments_user_{user_id}`.

**Key Functions:**

```python
get_collection(user_id: str) -> chromadb.Collection
    # Creates or retrieves user's segment collection
    # Distance metric: cosine

add_segment_embedding(
    user_id: str,
    segment_id: str,
    text: str,
    code_label: str,
    document_id: str,
    created_at: str
) -> None
    # Embeds text using embed_text(), upserts to collection
    # Metadata stored: code, document_id, text_preview (first 200 chars), created_at

find_similar_segments(
    user_id: str,
    query_text: str,
    top_k: int = 10,
    code_filter: str | None = None
) -> list[dict]
    # Cosine similarity search; optional filter by code label
    # Returns: [{id, text, code, document_id, distance}, ...]

delete_segment_embedding(user_id: str, segment_id: str) -> None
    # Silent on not-found (segment may have been deleted before embedding)

get_all_segments_for_code(
    user_id: str,
    code_label: str,
    exclude_id: str | None = None
) -> list[dict]
    # Fetches ALL segments for a code, sorted by created_at ascending
    # Used for centroid computation and temporal drift analysis

get_segment_count(user_id: str) -> int
    # Total segment count in user's collection
```

**Embedding Strategy:**
- Primary: Azure OpenAI embedding API (`text-embedding-ada-002`)
- Fallback: `all-MiniLM-L6-v2` SentenceTransformer (local)

#### WebSocket Manager (`backend/infrastructure/websocket/manager.py`)

```python
class ConnectionManager:
    connections: dict[str, list[WebSocket]]  # user_id → active sockets

    async def connect(websocket: WebSocket, user_id: str) -> None
    async def disconnect(websocket: WebSocket, user_id: str) -> None
    async def send_alert(user_id: str, alert: dict) -> None
        # Sends JSON to all active sockets for a user
    def send_alert_threadsafe(user_id: str, payload: dict) -> None
        # Thread-safe variant: uses asyncio.run_coroutine_threadsafe()
        # Called from background pipeline threads
    async def broadcast(alert: dict) -> None
        # Sends to ALL connected users (not used in production)
```

The event loop reference is set at application startup (`main.py` lifespan) to enable threadsafe dispatch from synchronous background threads.

---

### 3.7 Feature: Projects

**Files:** `backend/features/projects/`

#### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/projects` | Required | Create new project |
| GET | `/api/projects` | Required | List user's accessible projects |
| GET | `/api/projects/{id}` | Required | Get single project |
| DELETE | `/api/projects/{id}` | Owner only | Delete project + all data |
| GET | `/api/projects/{id}/settings` | Member | Get perspectives + thresholds |
| PUT | `/api/projects/{id}/settings` | Owner only | Update settings |
| GET | `/api/projects/{id}/members` | Member | List project members |
| POST | `/api/projects/{id}/members` | Owner only | Invite by email |
| DELETE | `/api/projects/{id}/members/{user_id}` | Owner only | Remove coder |
| GET | `/api/projects/threshold-definitions` | Required | List available thresholds |

#### Schemas

```typescript
ProjectCreate: { name: string }
ProjectOut: {
    id, name, user_id, created_at,
    document_count, code_count,
    enabled_perspectives, thresholds
}
ProjectSettingsOut: {
    enabled_perspectives: string[],
    thresholds: ThresholdOverride[]
}
MemberOut: { user_id, email, display_name, role, joined_at }
```

#### Service Logic

- `create_new_project()` creates the Project record AND a ProjectMember row with `role="owner"`
- `get_merged_thresholds()` merges global config thresholds with project-level overrides — project values win
- `cleanup_project_vectors()` iterates all project segments and deletes each from ChromaDB

#### Constants

`AVAILABLE_PERSPECTIVES`: 4 perspectives available for selection (e.g., "consistency", "intent", "definitional_fit", "temporal_drift"). Each has id, label, description, and which audit signals it activates.

`THRESHOLD_DEFINITIONS`: List of configurable threshold dicts with: id, key, default_value, min, max, step, description, unit.

---

### 3.8 Feature: Documents

**Files:** `backend/features/documents/`

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/documents/upload` | Multipart upload (PDF/DOCX/TXT) |
| POST | `/api/documents/paste` | Paste raw text |
| GET | `/api/documents` | List documents (filter by project_id) |
| GET | `/api/documents/{id}` | Get single document with full_text |
| DELETE | `/api/documents/{id}` | Delete + cascade |

#### File Parsing (`file_parser.py`)

```python
extract_text(filename: str, content: bytes) -> str
    # Dispatches to: _extract_pdf, _extract_docx, _extract_txt
    # PDF: pypdf PdfReader → join pages
    # DOCX: python-docx Document → join paragraphs
    # TXT: decode UTF-8 with fallback to latin-1

extract_html(filename: str, content: bytes) -> str | None
    # Converts document to HTML for the annotated viewer
    # DOCX: mammoth library for high-fidelity HTML conversion
    # TXT: wraps in <p> tags, preserves newlines
    # PDF: HTML not generated (returns None)
```

#### Service Logic

- `normalise_text()` standardises line endings (CRLF → LF, CR → LF)
- `create_document_from_upload()` orchestrates: extract text → normalise → create DB record
- `cleanup_document_vectors()` deletes all segment embeddings + associated alerts for a document

---

### 3.9 Feature: Codes

**Files:** `backend/features/codes/`

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/codes` | Create code (label unique per project) |
| GET | `/api/codes?project_id=` | List codes with segment counts |
| PATCH | `/api/codes/{id}` | Update label/definition/colour |
| DELETE | `/api/codes/{id}` | Delete code + all segments/analyses |

#### Service Logic

- **Code creation**: Records `EditEvent` with `action="create"`
- **Code update**: Records `EditEvent` per changed field (`field_changed`, `old_value`, `new_value`)
- **Code deletion**: `cascade_delete_code()` —
  1. Deletes all `CodedSegment` records for this code
  2. Deletes each segment's vector embedding from ChromaDB
  3. Deletes all `AgentAlert` records referencing this code
  4. Deletes all `AnalysisResult` records
  5. Records `EditEvent` with `action="delete"`

---

### 3.10 Feature: Segments

**Files:** `backend/features/segments/`

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/segments` | Create segment; triggers audit if API key set |
| POST | `/api/segments/batch` | Batch create segments (no audit) |
| GET | `/api/segments?document_id=` | List segments for document |
| DELETE | `/api/segments/{id}` | Delete segment + alert + vector |
| GET | `/api/segments/alerts` | List alerts for user (unread_only filter) |

#### Segment Creation Flow

1. Generate UUID for segment
2. Call `create_segment_with_event()` which:
   - Inserts `CodedSegment` record (with `db.flush()` to populate `created_at`)
   - Records `EditEvent` with action="create"
3. Commit transaction
4. If Azure API key configured: start background thread `run_background_agents()`
5. Return `SegmentOut`

**Context Extraction:**
```python
extract_window(full_text: str, start: int, end: int, sentences: int = 2) -> str
    # Extracts surrounding sentences
    # Marks the coded span with >>> markers for LLM context
```

---

### 3.11 Feature: Audit Pipeline

**Files:** `backend/features/audit/`

The audit pipeline is the core AI feature of Co-Refine. It runs asynchronously in a background thread after each segment is created.

#### Router Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/segments/analyze` | Manually trigger code analysis |
| GET | `/api/segments/analyses` | List AnalysisResult rows for project |
| POST | `/api/segments/batch-audit` | Batch audit all project codes |

#### Orchestrator (`orchestrator.py`)

The main entry point `run_background_agents()` executes the full pipeline sequentially:

```
1. EMBEDDING STAGE
   └─ add_segment_embedding() → ChromaDB

2. STAGE 1: DETERMINISTIC SCORING
   └─ compute_stage1_scores() → {centroid_similarity, temporal_drift, is_pseudo_centroid, segment_count}
   └─ WS broadcast: DETERMINISTIC_SCORES

3. STAGE 2: LLM AUDIT
   └─ build context (history, codebook, window)
   └─ run_coding_audit() → {self_lens, overall_severity_score, overall_severity}
   └─ persist: ConsistencyScore + AgentAlert
   └─ WS broadcast: CODING_AUDIT

4. AUTO-ANALYSIS (if segment_count >= threshold)
   └─ analyze_quotes() → {definition, lens, reasoning}
   └─ persist: AnalysisResult
   └─ WS broadcast: ANALYSIS_UPDATED, REFLECTION_COMPLETE

5. SIBLING RE-AUDIT
   └─ Find all segments overlapping same span
   └─ Re-run stages 1-3 for each sibling

6. CODE OVERLAP MATRIX
   └─ compute_code_overlap_matrix() for all project codes
   └─ WS broadcast: CODE_OVERLAP_MATRIX
   └─ Create AgentAlert for codes exceeding overlap threshold
```

#### LLM Auditor (`llm_auditor.py`)

**Code Analysis:**
```python
analyze_quotes(
    code_label: str,
    quotes: list[str],          # all segments for this code
    user_definition: str | None  # researcher's definition
) -> dict
    # Returns: {definition, lens, reasoning}
    # Uses reasoning model (o1-mini)
    # Synthesises an operational definition from the researcher's own coding patterns
```

**Coding Audit:**
```python
run_coding_audit(
    user_history: list[dict],          # top-8 similar segments (MMR sampled)
    code_definitions: dict,             # AI-inferred definitions
    new_quote: str,                     # segment being audited
    proposed_code: str,                 # code being applied
    document_context: str,              # window around segment
    user_code_definitions: dict,        # researcher's own definitions
    existing_codes_on_span: list[str],  # overlapping codes
    centroid_similarity: float,
    temporal_drift: float | None,
    is_pseudo_centroid: bool,
    segment_count: int
) -> dict
    # Returns full self_lens dict:
    # {
    #   consistency_score,
    #   intent_alignment_score,
    #   severity,
    #   headline,
    #   finding,
    #   definition_note,
    #   drift_warning,
    #   action,
    #   evidence_note,
    #   alternative_codes: [...]
    # }
```

#### Context Builder (`context_builder.py`)

```python
build_code_definitions(db, project_id) -> dict[label: {definition, lens}]
    # Fetches most-recent AnalysisResult per code
    # Returns AI-inferred operational definitions

build_user_code_definitions(db, project_id) -> dict[label: str]
    # Fetches researcher-supplied definitions from Code.definition

extract_window(full_text, start, end, sentences=2) -> str
    # Sentence-level context window extraction
    # Marks segment boundaries with >>> ... <<<
```

#### Batch Auditor (`batch_auditor.py`)

Iterates all codes in a project and:
1. Selects a representative segment (most diverse, via MMR)
2. Runs Stage 1 + Stage 2 for that segment
3. Broadcasts `BATCH_AUDIT_PROGRESS` per code
4. Computes code overlap matrix across all codes
5. Broadcasts `BATCH_AUDIT_DONE`

---

### 3.12 Feature: Scoring (Deterministic)

**Files:** `backend/features/scoring/`

All Stage 1 scoring is **deterministic** — no LLM required.

#### Pipeline Entry (`pipeline.py`)

```python
compute_stage1_scores(
    user_id: str,
    segment_text: str,
    code_label: str,
    all_code_labels: list[str],
    code_definition: str | None
) -> dict
    # Returns:
    # {
    #   centroid_similarity: float,      # [0, 1] — how well segment fits code
    #   is_pseudo_centroid: bool,        # True if definition fallback was used
    #   temporal_drift: float | None,    # cosine distance between old/new centroids
    #   segment_count: int               # total segments for this code
    # }
```

#### Centroid Computation (`centroid.py`)

```python
_compute_centroid(embeddings: list[list[float]]) -> list[float]
    # L2-normalized mean of embedding vectors

get_code_centroid_with_fallback(
    user_id: str,
    code_label: str,
    code_definition: str | None,
    min_segments: int = 3
) -> tuple[list[float], bool]
    # Returns (centroid, is_pseudo)
    # If < min_segments: embeds definition text as fallback centroid
    # If no definition either: returns (None, True)

segment_to_centroid_similarity(
    user_id: str,
    segment_text: str,
    code_label: str,
    code_definition: str | None
) -> tuple[float, bool]
    # Embeds segment, computes cosine similarity against code centroid
    # Returns (similarity, is_pseudo_centroid)
```

**Interpretation of Centroid Similarity:**
- 0.85–1.0: Strong fit (consistent with past coding)
- 0.65–0.85: Moderate fit
- 0.0–0.65: Weak fit (likely inconsistent)

#### Temporal Drift (`temporal_drift.py`)

```python
compute_temporal_drift(
    user_id: str,
    code_label: str,
    window_recent: int = 5,
    window_old: int = 5
) -> float | None
    # Returns None if fewer than window_recent + window_old segments exist
    # Otherwise: cosine distance between:
    #   centroid(oldest N segments) and centroid(newest N segments)
    # High value (> 0.3) = researcher's understanding of code has drifted
```

#### Code Overlap (`code_overlap.py`)

```python
compute_code_overlap_matrix(
    user_id: str,
    code_labels: list[str]
) -> dict[str, dict[str, float]]
    # Pairwise cosine similarity between code centroids
    # Symmetric matrix
    # Value > 0.85 = codes may be semantically redundant
```

---

### 3.13 Feature: Chat

**Files:** `backend/features/chat/`

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send message; returns conversation_id |
| GET | `/api/chat/history/{conversation_id}` | Fetch conversation messages |
| DELETE | `/api/chat/conversations/{conversation_id}` | Delete conversation |
| GET | `/api/chat/conversations?project_id=` | List conversations with previews |

#### Service Logic

**Message Send Flow:**
1. Retrieve or create conversation
2. Retrieve similar segments from vector store (top-5, no code filter)
3. Build codebook context from AnalysisResult rows
4. Fetch conversation history (last 10 messages)
5. Save user message to DB
6. Start background streaming task

**Streaming:**
```python
stream_response_background(user_id, conversation_id, messages, context) -> None
    # Broadcasts CHAT_STREAM_START
    # Streams tokens one by one → CHAT_TOKEN events
    # Broadcasts CHAT_DONE on completion
    # Saves full response to DB
    # Broadcasts CHAT_ERROR on failure
```

**System Prompt Context Includes:**
- Project's codebook (all codes + definitions + AI analyses)
- Retrieved segments relevant to the user's question
- Instruction to respond as a qualitative research assistant

---

### 3.14 Feature: Facets

**Files:** `backend/features/facets/`

Facet analysis automatically discovers sub-patterns within a code by clustering its segments.

#### Service Logic

```python
run_facet_analysis(db: Session, user_id: str, code_id: str) -> None
```

**Algorithm:**
1. Fetch all segment embeddings for the code from ChromaDB
2. If fewer than 4 segments: skip (insufficient data)
3. Run KMeans clustering with K = 2, 3, 4 — select best K by silhouette score
4. Run t-SNE (2D reduction) on all segment embeddings
5. Store t-SNE coordinates back on `CodedSegment.tsne_x/tsne_y`
6. Create/update `Facet` records for each cluster
7. Create `FacetAssignment` records linking segments to their facets
8. Call `suggest_facet_labels()` to generate AI-suggested names
9. Broadcast `FACET_UPDATED` event

```python
suggest_facet_labels(db: Session, code_id: str, facets: list[Facet]) -> None
    # For each facet: sends segment texts to LLM
    # LLM suggests a short descriptive label
    # Updates Facet.suggested_label, sets label_source="ai"
```

---

### 3.15 Feature: Visualisations

**Files:** `backend/features/visualisations/`

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/{id}/vis/overview` | KPI stats + trend data |
| GET | `/api/projects/{id}/vis/facets` | Facet cluster data |
| GET | `/api/projects/{id}/vis/consistency` | Consistency timeline |
| GET | `/api/projects/{id}/vis/overlap` | Code overlap matrix |
| GET | `/api/projects/{id}/vis/code-cooccurrence` | Code co-occurrence matrix |
| PATCH | `/api/projects/{id}/vis/facets/{facet_id}/label` | User-relabel facet |
| POST | `/api/projects/{id}/vis/facets/suggest-labels` | Re-run AI label suggestion |
| POST | `/api/projects/{id}/vis/facets/{facet_id}/explain` | LLM explanation of facet |

#### Service Outputs

**Overview:**
```json
{
  "total_segments": 147,
  "total_codes": 12,
  "avg_consistency": 0.82,
  "avg_centroid_sim": 0.79,
  "metrics_over_time": [
    { "date": "2026-02-01", "avg_consistency": 0.78, "avg_centroid_sim": 0.75 }
  ],
  "top_variable_codes": [...],     // codes with highest consistency score variance
  "top_temporal_drift_codes": [...]  // codes with highest drift
}
```

**Facets:** Returns facet records with t-SNE coordinates for scatter plot, segment assignments, labels.

**Consistency:** Per-code time series of `avg_llm_score` + `avg_centroid_sim` over dates.

**Overlap:** Symmetric pairwise cosine similarity matrix between all code centroids.

**Co-occurrence:** Symmetric matrix counting how many segments share exact span boundaries between each code pair.

---

### 3.16 Feature: Edit History

**File:** `backend/features/edit_history/`

#### API Endpoint

```
GET /api/projects/{id}/edit-history
    Query: document_id (optional), entity_type (optional), limit (default 50), offset (default 0)
    Returns: EditEventOut[]
```

Returns a paginated, filterable audit trail of all coding decisions for a project, ordered by `created_at` descending.

---

### 3.17 Feature: ICR (Inter-Coder Reliability)

**Files:** `backend/features/icr/`

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/{id}/icr/overview` | Agreement stats summary |
| GET | `/api/projects/{id}/icr/per-code` | Per-code agreement metrics |
| GET | `/api/projects/{id}/icr/agreement-matrix` | Code pair agreement matrix |
| GET | `/api/projects/{id}/icr/disagreements` | Paginated disagreement list |
| POST | `/api/projects/{id}/icr/disagreements/{id}/resolve` | Resolve disagreement |

#### Metrics Computed

- **Cohen's Kappa (κ):** Pairwise agreement between 2 coders, corrected for chance
- **Fleiss' Kappa:** Multi-coder generalisation of Cohen's kappa
- **Krippendorff's Alpha:** More flexible; handles missing data and multiple coders

**Disagreement Types:**
- `same_span_different_code` — Two coders assigned different codes to the same text span
- `one_sided_code` — One coder coded a segment that another coder left uncoded
- `partial_span_overlap` — Coders coded overlapping but not identical spans

**Resolution Types:**
- `accept_code_a` / `accept_code_b` — Adopt one coder's decision
- `create_new` — Create a new code to resolve the disagreement
- `remove_both` — Discard the coding entirely

---

### 3.18 Prompt Engineering

**Files:** `backend/prompts/`

#### Audit Prompt (`audit_prompt.py`)

The audit prompt is carefully engineered for two purposes:
1. Enforce numerical consistency between embedding similarity and LLM score
2. Produce plain-language explanations appropriate for qualitative researchers

**System Prompt Structure:**

*Scoring Rules section:*
- `consistency_score` ∈ [0, 1]: Must stay within ±0.15 of `centroid_similarity` (grounds LLM score in evidence)
- `intent_alignment_score`: Purely semantic judgement — does the segment match the code's intent?
- `overall_severity` = 1 − consistency_score: Ensures severity inversely correlates with consistency
- Explicit penalty for large discrepancies between embedding evidence and LLM score

*Writing Rules section:*
- Audience: Qualitative researchers, not data scientists
- Headlines: 10 words max, action-oriented
- Finding: What the evidence shows (plain language)
- Drift warning: Contextualised for researchers who may not understand cosine distance
- Action items: Specific, actionable (e.g., "Re-read your earliest segments for this code")

*Output format:*
```json
{
  "self_lens": {
    "consistency_score": 0.82,
    "intent_alignment_score": 0.79,
    "severity": "low",
    "headline": "Consistent application — well-aligned with past usage",
    "finding": "...",
    "definition_note": "...",
    "drift_warning": "...",
    "action": "...",
    "evidence_note": "...",
    "alternative_codes": ["code_b", "code_c"]
  },
  "overall_severity_score": 0.18,
  "overall_severity": "low"
}
```

**User Prompt Template:**
1. Surrounding document context (with `>>>` segment markers)
2. Deterministic evidence (centroid_similarity, temporal_drift, is_pseudo_centroid, segment_count)
3. Researcher's codebook (user-supplied definitions per code)
4. AI-inferred operational definitions (from AnalysisResult)
5. Coding history (top-8 most similar prior segments)
6. The new segment being audited

#### Analysis Prompt (`analysis_prompt.py`)

Uses the reasoning model to synthesise a code definition from the researcher's own coding patterns:

**Input:** All segments for a code + researcher's definition
**Output:** `{definition, lens, reasoning}`

- `definition`: Concise operational definition inferred from patterns
- `lens`: Analytical lens being applied (e.g., "sociological", "linguistic")
- `reasoning`: Trace of how the definition was derived

#### Chat Prompt (`chat_prompt.py`)

Builds a system prompt including:
- Full codebook (codes, definitions, AI analyses)
- Retrieved segments relevant to the user's question
- Instruction to act as a qualitative research assistant

---

## 4. Frontend Architecture

### 4.1 Technology Stack

| Technology | Version | Role |
|-----------|---------|------|
| React | 19 | UI framework (functional components + hooks only) |
| TypeScript | ~5.7 (strict) | Type safety |
| Zustand | v5 | Global state management (slice pattern) |
| Tailwind CSS | 3 | Utility-first styling |
| Radix UI | latest | Accessible UI primitives (Dialog, Popover, Tabs, etc.) |
| Recharts | 2 | Chart components |
| Lucide React | latest | Icon library |
| Vite | 6 | Build tool + dev server |
| Vitest | latest | Unit test runner |
| React Testing Library | latest | Component testing |
| Playwright | latest | End-to-end testing |
| axe-core / jest-axe | latest | Accessibility testing |
| react-resizable-panels | latest | Resizable 3-panel layout |

---

### 4.2 Folder Structure & Layer Boundaries

```
frontend/src/
├── app/            Root layout, route guards, keyboard shortcuts
├── features/       Self-contained domain feature slices
│   ├── audit/      Alert display, audit pipeline UI
│   ├── chat/       Chat UI with streaming support
│   ├── codes/      Codebook CRUD
│   ├── documents/  Upload, viewer, margin annotations
│   ├── history/    Edit history timeline
│   ├── icr/        Inter-coder reliability dashboard
│   ├── project/    Settings, members, thresholds
│   ├── selection/  Text selection, highlight popover
│   └── visualisations/ Visualisation dashboards
├── widgets/        Composed layout regions (use features)
│   ├── LeftPanel/
│   ├── RightPanel/
│   ├── Toolbar/
│   └── StatusBar/
└── shared/         Cross-cutting infrastructure
    ├── api/        REST API client
    ├── hooks/      useWebSocket, useTextSelection, useDraggable
    ├── lib/        utils, constants, alert-helpers, annotated-text
    ├── store/      Zustand slices + composed store
    ├── types/      All TypeScript interfaces
    └── ui/         Badge, IconButton, ChartSkeleton
```

**Layer boundary rules (strictly enforced):**
- `app` → `widgets` → `features` → `shared` (downward only)
- `shared` never imports from `features`
- `features/A` never imports from `features/B`
- `widgets` never imports from other `widgets`

Each feature has an `index.ts` barrel that exports only the public surface — internal components are not re-exported.

---

### 4.3 Root Application Shell

**File:** `frontend/src/app/App.tsx`

**Layout:** `react-resizable-panels` splits the viewport into 3 horizontal panels:
- **Left (14% default):** `LeftPanel` widget (collapsible via Ctrl+B)
- **Center (68% default):** Main content area (view-mode-driven)
- **Right (18% default, collapsible):** `RightPanel` widget (Ctrl+J)

**View Modes (driven by `uiSlice.viewMode`):**

| viewMode | Rendered Component | Condition |
|----------|-------------------|-----------|
| `"document"` | `DocumentViewer` | Active document selected |
| `"document"` | `DocumentUpload` | No document + `showUploadPage` |
| `"dashboard"` | `Visualisations` | Active project selected |
| `"history"` | `EditHistoryView` | Active project selected |
| `"icr"` | `ICRView` | Active project selected |

**Keyboard Shortcuts:**
- `Ctrl+B` — Toggle left panel
- `Ctrl+J` — Toggle right panel
- `Ctrl+K` — Open code search

**Auth Guard:** Renders `LoginPage` or `RegisterPage` if no auth token in sessionStorage. Listens for `co_refine:unauthorized` DOM event (emitted by API client on 401) to auto-logout.

**WebSocket:** `useWebSocket()` hook called at root level — establishes single WS connection per session.

---

### 4.4 Zustand State Management

**Files:** `frontend/src/shared/store/`

All slices use the `StateCreator<AppState, [], [], SliceType>` pattern and are composed in `store.ts`:

```typescript
export const useStore = create<AppState>()((...args) => ({
  ...createAuthSlice(...args),
  ...createUiSlice(...args),
  ...createProjectSlice(...args),
  ...createDocumentSlice(...args),
  ...createCodeSlice(...args),
  ...createSegmentSlice(...args),
  ...createAuditSlice(...args),
  ...createChatSlice(...args),
  ...createHistorySlice(...args),
}))
```

Cross-slice access uses `get()`: e.g., `get().activeProjectId` inside a code slice action.

#### Slice Reference

**AuthSlice**
```typescript
{
  authUser: AuthUser | null
  token: string | null
  initAuth: () => void           // Reads sessionStorage on mount
  loginUser: (email, password) => Promise<void>
  registerUser: (email, password, displayName) => Promise<void>
  logout: () => void             // Clears sessionStorage + resets state
}
```

**UiSlice**
```typescript
{
  viewMode: ViewMode             // "document" | "dashboard" | "history" | "icr"
  rightPanelTab: RightPanelTab   // "alerts" | "chat"
  showUploadPage: boolean
  selectedVisCodeId: string | null  // Cross-filter for vis charts
  overlapMatrix: Record<string, Record<string, number>> | null
  setViewMode: (v: ViewMode) => void
  setRightPanelTab: (t: RightPanelTab) => void
  setSelectedVisCodeId: (id: string | null) => void
  setOverlapMatrix: (m: ...) => void
  triggerVisRefresh: () => void  // Increments refresh counter
}
```

**ProjectSlice**
```typescript
{
  projects: ProjectOut[]
  activeProjectId: string | null
  loadProjects: () => Promise<void>
  createProject: (name) => Promise<void>
  deleteProject: (id) => Promise<void>
  setActiveProjectId: (id) => void
}
```

**DocumentSlice**
```typescript
{
  documents: DocumentOut[]
  activeDocumentId: string | null
  loadDocuments: (projectId) => Promise<void>
  uploadDocument: (projectId, file | text) => Promise<void>
  deleteDocument: (id) => Promise<void>
  setActiveDocumentId: (id) => void
}
```

**CodeSlice**
```typescript
{
  codes: CodeOut[]
  activeCodeId: string | null
  codeSearch: string
  loadCodes: (projectId) => Promise<void>
  createCode: (projectId, label, definition, colour) => Promise<void>
  updateCode: (id, updates) => Promise<void>
  deleteCode: (id) => Promise<void>
  setActiveCodeId: (id) => void
  setCodeSearch: (q) => void
  loadAnalyses: (projectId) => Promise<void>
}
```

**SegmentSlice**
```typescript
{
  segments: SegmentOut[]
  pendingApplications: PendingApplication[]
  clickedSegments: SegmentOut[]
  selection: TextSelection | null
  scrollToSegmentId: string | null
  loadSegments: (documentId) => Promise<void>
  createSegment: (documentId, codeId, text, start, end) => Promise<void>
  applyCode: (codeId) => void           // Adds to pendingApplications
  submitPendingApplications: () => void  // Batch creates all pending
  deleteSegment: (id) => Promise<void>
  setClickedSegments: (segments) => void
  setSelection: (sel) => void
  setScrollToSegmentId: (id) => void
}
```

**AuditSlice**
```typescript
{
  alerts: AlertOut[]
  auditStage: AuditStage
  agentsRunning: boolean
  pushAlert: (msg) => void              // Handles all WS messages → alerts
  dismissAlert: (id) => void
  markAlertRead: (id) => void
  applySuggestedCode: (alert) => void   // Re-codes segment with suggested code
  loadAlerts: (projectId) => Promise<void>
}
```

**ChatSlice**
```typescript
{
  chatMessages: ChatMessageOut[]
  chatStreaming: boolean
  chatConversationId: string | null
  conversations: ConversationPreview[]
  sendChatMessage: (projectId, content) => Promise<void>
  appendChatToken: (token) => void
  finishChatStream: () => void
  loadConversations: (projectId) => Promise<void>
  loadChatHistory: (conversationId) => Promise<void>
  deleteConversation: (id) => Promise<void>
}
```

**HistorySlice**
```typescript
{
  editHistory: EditEventOut[]
  historyScope: HistoryScope           // "all" | "code" | "segment"
  loadEditHistory: (projectId, filters) => Promise<void>
  setHistoryScope: (scope) => void
}
```

---

### 4.5 API Client

**File:** `frontend/src/shared/api/client.ts`

**Base configuration:**
- Base URL: `VITE_API_URL + "/api"` (defaults to same-origin `/api`)
- Auth: `Authorization: Bearer <token>` header from sessionStorage
- Ngrok bypass header added if hostname includes `ngrok`

**Error handling:** 401 responses emit custom DOM event `co_refine:unauthorized` — caught by `App.tsx` to trigger logout.

**Key API Functions by Domain:**

```typescript
// Auth
loginUser(email, password): Promise<TokenResponse>
registerUser(email, password, displayName): Promise<TokenResponse>

// Projects
createProject(name): Promise<ProjectOut>
fetchProjects(): Promise<ProjectOut[]>
deleteProject(id): Promise<void>
getProjectSettings(id): Promise<ProjectSettingsOut>
updateProjectSettings(id, settings): Promise<ProjectSettingsOut>
listProjectMembers(id): Promise<MemberOut[]>
inviteProjectMember(id, email): Promise<MemberOut>
removeProjectMember(id, userId): Promise<void>
getThresholdDefinitions(): Promise<ThresholdDefinition[]>

// Documents
uploadDocument(projectId, file): Promise<DocumentUploadResponse>
pasteDocument(projectId, title, text): Promise<DocumentUploadResponse>
fetchDocuments(projectId): Promise<DocumentOut[]>
getDocument(id): Promise<DocumentOut>
deleteDocument(id): Promise<void>

// Codes
createCode(projectId, label, definition, colour): Promise<CodeOut>
fetchCodes(projectId): Promise<CodeOut[]>
updateCode(id, updates): Promise<CodeOut>
deleteCode(id): Promise<void>
getCodeAnalyses(projectId): Promise<AnalysisOut[]>

// Segments
createSegment(documentId, codeId, text, startIndex, endIndex): Promise<SegmentOut>
batchCreateSegments(segments): Promise<SegmentOut[]>
fetchSegments(documentId): Promise<SegmentOut[]>
deleteSegment(id): Promise<void>
fetchAlerts(unreadOnly?): Promise<AlertOut[]>

// Audit
triggerAnalysis(projectId, codeId): Promise<void>
batchAudit(projectId): Promise<void>

// Chat
sendChatMessage(projectId, content, conversationId?): Promise<{conversation_id}>
fetchChatHistory(conversationId): Promise<ChatMessageOut[]>
listConversations(projectId): Promise<ConversationPreview[]>
deleteConversation(id): Promise<void>

// Visualisations
fetchVisOverview(projectId): Promise<VisOverviewData>
fetchVisFacets(projectId, codeId?): Promise<FacetData[]>
fetchVisConsistency(projectId): Promise<ConsistencyData>
fetchVisOverlap(projectId): Promise<OverlapMatrix>
fetchCodeCooccurrence(projectId): Promise<CooccurrenceMatrix>
relabelFacet(projectId, facetId, label): Promise<Facet>
suggestFacetLabels(projectId): Promise<void>
explainFacet(projectId, facetId): Promise<{explanation}>

// Edit History
fetchEditHistory(projectId, filters?): Promise<EditEventOut[]>

// ICR
fetchICROverview(projectId): Promise<ICROverview>
fetchICRPerCode(projectId): Promise<ICRPerCode[]>
fetchICRAgreementMatrix(projectId): Promise<AgreementMatrix>
fetchICRDisagreements(projectId, filters?): Promise<Disagreement[]>
resolveICRDisagreement(projectId, id, resolution): Promise<void>
```

---

### 4.6 WebSocket Client Hook

**File:** `frontend/src/shared/hooks/useWebSocket.ts`

Establishes a single WebSocket connection per session. Reconnects automatically after 3s on unexpected close (except auth failure code 4001).

```typescript
useWebSocket(): void
// Called once in App.tsx
// URL: ws(s)://{host}/ws?token={jwt_token}
```

**Message Routing Logic:**

```typescript
onmessage = (event) => {
  const msg = JSON.parse(event.data)

  switch(msg.type) {
    case "chat_token":
      appendChatToken(msg.token)
      return  // ← no alert

    case "chat_done":
    case "chat_stream_start":
    case "chat_error":
      finishChatStream()
      return  // ← no alert

    case "facet_updated":
      triggerVisRefresh()
      return  // ← no alert

    case "code_overlap_matrix":
      setOverlapMatrix(msg.data)
      return  // ← no alert

    default:
      pushAlert(msg)  // All others → alert store

    case "analysis_updated":
      pushAlert(msg)
      loadAnalyses(activeProjectId)  // Also triggers code reload
      loadCodes(activeProjectId)
      break

    case "batch_audit_done":
    case "coding_audit":
      pushAlert(msg)
      triggerVisRefresh()  // Refreshes visualisation charts
      break
  }
}
```

---

### 4.7 TypeScript Type System

**File:** `frontend/src/shared/types/index.ts`

All TypeScript interfaces are defined here as the single source of truth.

**Core Domain Types:**

```typescript
interface AuthUser {
  id: string
  email: string
  display_name: string
}

interface ProjectOut {
  id: string
  name: string
  user_id: string
  document_count: number
  code_count: number
  enabled_perspectives: string[]
  thresholds: ThresholdOverride[]
  created_at: string
}

interface DocumentOut {
  id: string
  project_id: string
  title: string
  full_text: string
  doc_type: string
  html_content: string | null
  created_at: string
}

interface CodeOut {
  id: string
  project_id: string
  label: string
  definition: string | null
  colour: string
  segment_count: number
  created_at: string
}

interface SegmentOut {
  id: string
  document_id: string
  code_id: string
  text: string
  start_index: number
  end_index: number
  user_id: string
  created_at: string
  code?: CodeOut
}

interface AlertOut {
  id: string
  segment_id: string | null
  alert_type: string
  payload: AlertPayload
  is_read: boolean
  created_at: string
}

type AlertPayload =
  | CodingAuditPayload
  | DeterministicScoresPayload
  | BatchAuditProgressPayload
  | CodeOverlapMatrixPayload
  | TemporalDriftPayload
  | AnalysisUpdatedPayload
  | AgentThinkingPayload
  | AgentErrorPayload
  // ... 8+ more

interface DeterministicScores {
  centroid_similarity: number
  is_pseudo_centroid: boolean
  temporal_drift: number | null
  segment_count: number
}

type ViewMode = "document" | "dashboard" | "history" | "icr"
type RightPanelTab = "alerts" | "chat"

interface TextSelection {
  text: string
  startIndex: number
  endIndex: number
  rect: DOMRect
}

interface ChatMessageOut {
  id: string
  conversation_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

interface EditEventOut {
  id: string
  entity_type: string
  action: string
  entity_id: string
  field_changed: string | null
  old_value: string | null
  new_value: string | null
  user_id: string
  created_at: string
}
```

---

### 4.8 Feature: Audit UI

**Files:** `frontend/src/features/audit/components/`

#### AlertsTab

The orchestrator for the right panel's Alerts tab:
- Filters out hidden pipeline signals (AGENTS_STARTED, AGENT_THINKING)
- Shows `AuditStageProgress` bar when `agentsRunning === true`
- Maps remaining alerts to `AlertCard` components
- Empty state message when no alerts

#### AlertCard

Routes alert types to appropriate display components:
- `coding_audit` → `CodingAuditCard`
- `temporal_drift_warning` → `TemporalDriftCard`
- `consistency_concern` → `ConsistencyActions`
- `ghost_partner` → `GhostPartnerActions`
- Action buttons: **Dismiss**, **Apply suggested code**, **Keep my code**

#### CodingAuditCard

Compact summary of an audit result:
- `SeverityBadge` (High/Medium/Low with colour coding)
- Headline text
- Expand toggle → `CodingAuditDetail`
- Code label + timestamp

#### CodingAuditDetail

Expanded audit view showing all audit fields:
- `MetricStrip` for centroid_similarity, temporal_drift, segment_count
- Headline, finding, definition_note, drift_warning
- Action item
- Evidence note
- Alternative codes (clickable to apply)

#### AuditStageProgress

3-step progress bar showing pipeline state:
1. **Embedding** — Storing segment in vector database
2. **Scoring** — Computing deterministic scores
3. **Audit Analysis** — LLM consistency check

Each step shows: pending (grey), running (animated), done (green).

#### MetricTooltip

On hover over any metric (centroid_similarity, temporal_drift), shows plain-language explanation from `shared/lib/constants.ts` AUDIT_EXPLANATIONS dictionary.

#### SeverityBadge

```typescript
<SeverityBadge severity="high" | "medium" | "low" />
// high → red background
// medium → yellow background
// low → green background
```

---

### 4.9 Feature: Chat UI

**Files:** `frontend/src/features/chat/components/`

#### ChatTab

Orchestrator for the Chat tab:
- `ConversationList` sidebar (toggle button)
- `ChatMessageList` (message history + streaming)
- `ChatInput` (textarea + submit button)
- Handles Enter-to-submit keyboard shortcut

#### ChatMessageList

- Renders user messages (right-aligned, brand colour) and assistant messages (left-aligned, surface colour)
- Shows streaming cursor during `chatStreaming === true`
- Auto-scrolls to bottom on new messages

#### ChatInput

- Multi-line textarea
- Character count display
- Disabled state during streaming
- `Ctrl+Enter` to submit (configurable)

#### ConversationList

- Lists previous conversations with preview text + timestamp
- Delete button per conversation (with confirmation)
- Click to load conversation history

---

### 4.10 Feature: Documents UI

**Files:** `frontend/src/features/documents/components/`

#### DocumentViewer

The main document display and annotation surface:
- Renders `html_content` (if available) or `full_text` as annotated HTML
- Uses `buildAnnotatedText()` from `shared/lib/annotated-text.ts` to wrap segments in `<mark>` elements
- Click on `<mark>` → extracts overlapping segments → calls `setClickedSegments()` → opens `HighlightPopover`
- Scrolls to segment on `scrollToSegmentId` change
- Listens for `mouseup` events to capture new text selections

**Annotation colours:** Each code gets a semi-transparent background from its `colour` property. Inconsistent segments (severity > threshold) get a red border overlay.

#### DocumentUpload

- File picker (drag-and-drop + click)
- Supported formats: PDF, DOCX, TXT
- Paste text mode (switch toggle)
- Title field
- Upload button → calls `uploadDocument()` → switches to document view

#### MarginPills

Renders code label pills in the document margin:
- Positioned absolutely using segment `start_index` → DOM offset calculation
- Stacks overlapping pills vertically
- Click → scroll to segment + open popover

---

### 4.11 Feature: Codes UI

**Files:** `frontend/src/features/codes/components/`

#### CodesTabContent

Orchestrator for the left panel's code list:
- Search input (filters by label)
- "Create code" button → inline form
- Code list (`CodeListItem` per code)
- Expanded code detail panel (`ExpandedCodeDetail`) when a code is selected
- `RetrievedSegments` showing semantically similar segments

#### CodeListItem

Single code row:
- Colour swatch (circle in code's colour)
- Label text
- Segment count badge
- Click → set active code + load similar segments

#### ExpandedCodeDetail

Expanded panel for selected code:
- Full definition text (editable)
- Segment count
- Audit alerts related to this code
- Edit button (inline form for label/definition/colour)
- Delete button (with confirmation modal)
- "Trigger Analysis" button → calls `triggerAnalysis()` API

#### RetrievedSegments

Vector search results:
- Calls `find_similar_segments` via API when active code changes
- Displays top-10 similar segments with their distance scores
- Click → scroll to segment in document viewer

---

### 4.12 Feature: Selection & Highlight Popover

**Files:** `frontend/src/features/selection/components/`

#### HighlightPopover

A draggable floating popover that appears on:
1. **Text selection** (mouseup in DocumentViewer) → shows `SelectionView`
2. **Mark click** (click on existing segment highlight) → shows `ClickedSegmentsView`

Features:
- Position auto-adjusted to stay within viewport bounds
- Draggable (via `useDraggable` hook)
- Focus trap (via `usePopoverInteraction`)
- Closes on Escape or outside click
- Z-indexed above document content

#### SelectionView

Shown when user has selected new text:
- Displays selected text preview
- Code picker (dropdown or searchable list of project codes)
- "Apply" button → calls `applyCode()` → adds to `pendingApplications`
- `PendingApplicationsBar` shows queued codes
- "Submit all" → `submitPendingApplications()` → batch creates segments

#### ClickedSegmentsView

Shown when user clicks an existing segment highlight:
- Lists all overlapping segments at that span
- Per-segment: code label (with colour swatch), text preview, delete button
- Shows audit severity badge if segment has alerts

#### PendingApplicationsBar

Horizontal bar showing codes queued for application:
- One pill per pending code (colour-coded)
- Remove button per pending code
- "Submit" button → creates all segments in one batch request

---

### 4.13 Feature: Visualisations UI

**Files:** `frontend/src/features/visualisations/components/`

#### Visualisations

Tab shell with 5 tabs:
1. **Overview** — `VisOverviewTab`
2. **Facet Explorer** — `FacetExplorerTab`
3. **Consistency** — `ConsistencyTimeline`
4. **Code Overlap** — `CodeOverlapTab`
5. **Co-occurrence** — `CooccurrenceTab`

#### VisOverviewTab

Dashboard of project-level metrics:
- KPI cards: total segments, total codes, avg consistency score, avg centroid similarity
- Line chart (Recharts): consistency + centroid sim over time
- "Top Variable Codes" list: codes with highest score variance
- "Top Drift Codes" list: codes with highest temporal drift
- Clicking a code → sets `selectedVisCodeId` (cross-filter)
- "Run Batch Audit" button

#### FacetExplorerTab

Scatter plot exploration of code sub-patterns:
- t-SNE 2D scatter plot (Recharts ScatterChart)
- Points = segments, coloured by facet assignment
- Clicking a point → highlights in document view
- Left sidebar: facet list with labels + segment counts
- Click facet → `FacetDrillDown` shows segments in that facet
- "Relabel" button → opens inline text input
- "Explain this facet" → AI explanation in modal
- Cross-filter by `selectedVisCodeId`

#### ConsistencyTimeline

Per-code consistency over time:
- Line chart per code (or selected code if `selectedVisCodeId` is set)
- Dual Y-axis: LLM consistency score + centroid similarity
- Date range on X-axis

#### CodeOverlapTab

Heatmap of code centroid similarity:
- Symmetric matrix rendered as grid of coloured cells
- Cell colour: green (low overlap) → red (high overlap, > 0.85)
- Tooltip on hover: shows code pair labels + exact similarity
- Flagged pairs: high-overlap codes listed with suggestion to review/merge
- Uses `overlapMatrix` from UI store (populated by WS `code_overlap_matrix` event)

#### CooccurrenceTab

Heatmap of code co-occurrence (segments sharing exact spans):
- Symmetric matrix: how often each code pair appears together on the same text
- Helps identify whether two codes are consistently co-applied
- Tooltip with count + code labels

---

### 4.14 Feature: Edit History UI

**Files:** `frontend/src/features/history/components/`

#### EditHistoryView

Orchestrator:
- Filter dropdowns: document, entity_type, scope
- Loads `editHistory` from store
- Renders `HistoryTimeline`

#### HistoryTimeline

Chronological list of events:
- Groups by date
- Each event: entity type icon, action badge, entity label, timestamp
- For update events: shows `CodeChangeBanner`

#### CodeChangeBanner

Diff display for code label/definition changes:
- Shows `old_value` → `new_value` with visual diff styling
- Red strikethrough for removed content, green for additions

---

### 4.15 Feature: Project Settings

**Files:** `frontend/src/features/project/components/`

#### SettingsModal

Modal dialog (Radix Dialog) with 3 tabs:
1. **Perspectives** — `PerspectivesTab`
2. **Thresholds** — `ThresholdsTab`
3. **Members** — `MembersTab`

#### PerspectivesTab

Checkbox list of available audit perspectives (loaded from `getThresholdDefinitions()`). Selecting perspectives controls which audit signals are run.

#### ThresholdsTab

Slider inputs for each configurable threshold:
- Centroid similarity warning threshold
- Temporal drift warning threshold
- Code overlap warning threshold
- Auto-analysis segment count trigger

Shows current value + description. Dirty state tracked by `useProjectSettings` hook. Save/discard buttons.

#### MembersTab (via `MembersTab.tsx`)

- Lists current project members (email, role, joined date)
- "Invite coder" form: email input + invite button
- Remove button for coders (owner cannot be removed)

---

### 4.16 Feature: ICR UI

**Files:** `frontend/src/features/icr/components/`

#### ICRView

Orchestrator: tabbed layout with 5 tabs:
1. Overview, 2. Per-Code, 3. Agreement Matrix, 4. Disagreements, 5. Resolution

#### ICROverviewTab

- Summary statistics: Cohen's κ, Fleiss' κ, Krippendorff's α
- `ICRMetricCard` per metric: value + interpretation badge
- Number of coders, total comparisons, date of last sync

#### ICRAgreementMatrix

Heatmap of agreement between code pairs across coders:
- Grid: codes × coders (or codes × codes depending on metric)
- Colour-coded by agreement level

#### DisagreementsTab

Paginated list of disagreements:
- Filter by type, document, code
- `DisagreementCard` per item: shows the conflicting segment, coder A's code, coder B's code
- Button to open in resolution mode

#### ResolutionTab

Dispute resolution UI for a specific disagreement:
- Side-by-side view: coder A decision vs coder B decision
- Radio group: Accept A / Accept B / Create new code / Remove both
- Submit button → calls `resolveICRDisagreement()` API

---

### 4.17 Widgets

#### Toolbar (`widgets/Toolbar/Toolbar.tsx`)

Application header bar containing:
- Co-Refine logo + branding
- View mode buttons (icons + labels): Documents, Visualisations, ICR, History
- "Add Document" button → sets showUploadPage
- Project name (from active project)
- Settings button → opens SettingsModal
- Logout button

Keyboard navigation: `useToolbarKeyNav` hook implements arrow key navigation between toolbar buttons (WCAG 2.1 keyboard pattern).

#### Left Panel (`widgets/LeftPanel/LeftPanel.tsx`)

Two-section scrollable panel:
- **Project section:** `ProjectList` (collapsible tree), "New Project" button
- **Codebook section:** `CodesTabContent` (when project selected)

`ProjectList` renders `ProjectListItem` per project. `useProjectActions` hook handles rename/delete with optimistic updates.

#### Right Panel (`widgets/RightPanel/RightPanel.tsx`)

Tab-switching panel:
- Tab bar: "Alerts" (with unread badge count) + "Chat"
- Renders `AlertsTab` or `ChatTab` based on `rightPanelTab`
- Draggable resize handle on left edge

#### Status Bar (`widgets/StatusBar/StatusBar.tsx`)

Footer bar showing:
- Active document title + character count
- Segment count for active document
- Code count for active project
- User email
- WebSocket connection indicator

---

### 4.18 Shared Utilities & Libraries

#### `shared/lib/utils.ts`

```typescript
cn(...classes: ClassValue[]): string
    // Tailwind class merging (clsx + tailwind-merge)
    // Usage: cn("base-class", condition && "conditional-class")

hexToRgba(hex: string, alpha: number): string
    // Converts #RRGGBB to rgba(r, g, b, alpha)
    // Used for transparent segment highlights

getContrastColor(hex: string): "white" | "black"
    // Returns white or black depending on background luminance
    // Used for text-on-colour-swatch readability
```

#### `shared/lib/constants.ts`

```typescript
AUDIT_EXPLANATIONS: Record<string, string>
    // Plain-language explanations for each metric
    // Displayed in MetricTooltip on hover

SESSION_STORAGE_KEYS: {
    TOKEN: "co_refine_token",
    USER: "co_refine_user",
    // ...
}

SEVERITY_COLOURS: {
    high: "red-600",
    medium: "yellow-500",
    low: "green-600"
}
```

#### `shared/lib/annotated-text.ts`

```typescript
buildAnnotatedText(
    fullText: string,
    segments: SegmentOut[],
    inconsistentIds: Set<string>
): string
    // Returns an HTML string with segments wrapped in <mark> elements
    // <mark data-segment-id="..." data-code-id="..." style="background-color: rgba(...)">
    // Inconsistent segments get an additional red border class
    // Handles overlapping segments by layering transparent backgrounds
```

#### `shared/lib/alert-helpers.tsx`

```typescript
getAlertIcon(alertType: string): React.ReactElement
    // Returns Lucide icon for each alert type

getAlertColour(alertType: string): string
    // Returns Tailwind colour class for alert border/background

mapAlertToDisplayData(alert: AlertOut): {
    title, description, icon, colour, actions
}
    // Normalises heterogeneous alert payloads to consistent display shape
```

#### `shared/hooks/useTextSelection.ts`

```typescript
useTextSelection(containerRef: RefObject<HTMLElement>): TextSelection | null
    // Listens for mouseup events on container
    // Returns {text, startIndex, endIndex, rect} from window.getSelection()
    // startIndex/endIndex relative to container's text content
```

#### `shared/hooks/useDraggable.ts`

```typescript
useDraggable(ref: RefObject<HTMLElement>): { position: {x, y}, handleMouseDown }
    // Tracks pointer-based dragging for the HighlightPopover
    // Constrains position to viewport bounds
```

---

## 5. Data Flow & Integration

### 5.1 Segment Creation & Audit Flow

```
User selects text in DocumentViewer
    ↓
useTextSelection() captures TextSelection {text, startIndex, endIndex, rect}
    ↓
setSelection(selection) → segmentSlice
    ↓
HighlightPopover opens (position = selection.rect)
    ↓
User picks a code + clicks Apply
    ↓
applyCode(codeId) → pendingApplications.push({codeId, text, startIndex, endIndex})
    ↓
User clicks Submit
    ↓
submitPendingApplications() → batchCreateSegments(segments) → POST /api/segments/batch
    ↓
Backend: create CodedSegment records + EditEvent records
    ↓ (if single segment and API key configured)
Background thread: run_background_agents(segment_id, ...)
    │
    ├─ add_segment_embedding() → ChromaDB
    │       ↓ WS: (no event)
    │
    ├─ compute_stage1_scores()
    │       ↓ WS: DETERMINISTIC_SCORES → pushAlert() → AuditStageProgress updates
    │
    ├─ run_coding_audit()
    │       ↓ WS: CODING_AUDIT → pushAlert() → AlertCard appears in AlertsTab
    │
    ├─ analyze_quotes() (if auto_analysis_threshold reached)
    │       ↓ WS: ANALYSIS_UPDATED → loadAnalyses() + loadCodes()
    │
    ├─ run_background_agents() for sibling segments
    │       ↓ (same pipeline for each sibling)
    │
    └─ compute_code_overlap_matrix()
            ↓ WS: CODE_OVERLAP_MATRIX → setOverlapMatrix()
```

### 5.2 Real-Time WebSocket Event Flow

```
Backend background thread
    └─ ws_manager.send_alert_threadsafe(user_id, payload)
            ↓ asyncio.run_coroutine_threadsafe()
    └─ ws_manager.send_alert(user_id, payload)
            ↓ WebSocket.send_json()

Browser WebSocket
    └─ useWebSocket onmessage handler
            ↓ parse JSON
            ├─ chat_token → appendChatToken()
            ├─ facet_updated → triggerVisRefresh()
            ├─ code_overlap_matrix → setOverlapMatrix()
            └─ all others → pushAlert() → alerts[] in auditSlice
                                          ↓
                                    AlertsTab re-renders
                                    AlertCard appears
```

### 5.3 Batch Audit Flow

```
User clicks "Run Batch Audit"
    ↓
batchAudit(projectId) → POST /api/segments/batch-audit
    ↓
Background thread: batch_auditor.run_batch_audit()
    │
    ├─ WS: BATCH_AUDIT_STARTED
    │
    ├─ For each code in project:
    │   ├─ Select representative segment (MMR diversity)
    │   ├─ compute_stage1_scores()
    │   ├─ run_coding_audit()
    │   └─ WS: BATCH_AUDIT_PROGRESS {code_label, progress_pct}
    │
    ├─ compute_code_overlap_matrix()
    │   └─ WS: CODE_OVERLAP_MATRIX
    │
    └─ WS: BATCH_AUDIT_DONE
            ↓
    triggerVisRefresh() → Visualisations components re-fetch
```

### 5.4 Chat Message Flow

```
User types message + submits
    ↓
sendChatMessage(projectId, content) → POST /api/chat
    │
    ├─ find_similar_segments(user_id, content) → top-5 relevant segments
    ├─ build_codebook(projectId) → code definitions + AI analyses
    ├─ get_conversation_history_dicts(conversation_id) → last 10 messages
    └─ Save user message to DB
    ↓
Return { conversation_id } to frontend
    ↓
Background thread: stream_response_background()
    │
    ├─ WS: CHAT_STREAM_START → chatStreaming = true
    │
    ├─ Stream tokens from Azure OpenAI
    │   └─ WS: CHAT_TOKEN {token} → appendChatToken() (x many)
    │
    ├─ WS: CHAT_DONE → finishChatStream()
    │
    └─ Save full response to ChatMessage DB
```

---

## 6. API Endpoint Reference

Full list of all REST API endpoints:

### Authentication

| Method | Path | Body | Response |
|--------|------|------|---------|
| POST | `/api/auth/login` | `{email, password}` | `{access_token, token_type}` |
| POST | `/api/auth/register` | `{email, password, display_name}` | `{access_token, token_type}` |

### Projects

| Method | Path | Body / Query | Response |
|--------|------|-------------|---------|
| POST | `/api/projects` | `{name}` | ProjectOut |
| GET | `/api/projects` | — | ProjectOut[] |
| GET | `/api/projects/{id}` | — | ProjectOut |
| DELETE | `/api/projects/{id}` | — | 204 |
| GET | `/api/projects/{id}/settings` | — | ProjectSettingsOut |
| PUT | `/api/projects/{id}/settings` | `{enabled_perspectives, thresholds}` | ProjectSettingsOut |
| GET | `/api/projects/{id}/members` | — | MemberOut[] |
| POST | `/api/projects/{id}/members` | `{email}` | MemberOut |
| DELETE | `/api/projects/{id}/members/{user_id}` | — | 204 |
| GET | `/api/projects/threshold-definitions` | — | ThresholdDefinition[] |

### Documents

| Method | Path | Body / Query | Response |
|--------|------|-------------|---------|
| POST | `/api/documents/upload` | multipart: `file`, `project_id` | DocumentUploadResponse |
| POST | `/api/documents/paste` | `{project_id, title, text}` | DocumentUploadResponse |
| GET | `/api/documents` | `?project_id=` | DocumentOut[] |
| GET | `/api/documents/{id}` | — | DocumentOut |
| DELETE | `/api/documents/{id}` | — | 204 |

### Codes

| Method | Path | Body / Query | Response |
|--------|------|-------------|---------|
| POST | `/api/codes` | `{project_id, label, definition?, colour}` | CodeOut |
| GET | `/api/codes` | `?project_id=` | CodeOut[] |
| PATCH | `/api/codes/{id}` | `{label?, definition?, colour?}` | CodeOut |
| DELETE | `/api/codes/{id}` | — | 204 |
| GET | `/api/codes/analyses` | `?project_id=` | AnalysisOut[] |

### Segments & Audit

| Method | Path | Body / Query | Response |
|--------|------|-------------|---------|
| POST | `/api/segments` | SegmentCreate | SegmentOut |
| POST | `/api/segments/batch` | `{segments: SegmentCreate[]}` | SegmentOut[] |
| GET | `/api/segments` | `?document_id=` | SegmentOut[] |
| DELETE | `/api/segments/{id}` | — | 204 |
| GET | `/api/segments/alerts` | `?unread_only=` | AlertOut[] |
| POST | `/api/segments/analyze` | `{project_id, code_id}` | 202 Accepted |
| GET | `/api/segments/analyses` | `?project_id=` | AnalysisOut[] |
| POST | `/api/segments/batch-audit` | `{project_id}` | 202 Accepted |

### Chat

| Method | Path | Body / Query | Response |
|--------|------|-------------|---------|
| POST | `/api/chat` | `{project_id, content, conversation_id?}` | `{conversation_id}` |
| GET | `/api/chat/history/{conversation_id}` | — | ChatMessageOut[] |
| DELETE | `/api/chat/conversations/{conversation_id}` | — | 204 |
| GET | `/api/chat/conversations` | `?project_id=` | ConversationPreview[] |

### Visualisations

| Method | Path | Body / Query | Response |
|--------|------|-------------|---------|
| GET | `/api/projects/{id}/vis/overview` | — | VisOverviewData |
| GET | `/api/projects/{id}/vis/facets` | `?code_id=` | FacetData[] |
| GET | `/api/projects/{id}/vis/consistency` | — | ConsistencyData |
| GET | `/api/projects/{id}/vis/overlap` | — | OverlapMatrix |
| GET | `/api/projects/{id}/vis/code-cooccurrence` | — | CooccurrenceMatrix |
| PATCH | `/api/projects/{id}/vis/facets/{facet_id}/label` | `{label}` | Facet |
| POST | `/api/projects/{id}/vis/facets/suggest-labels` | — | 202 |
| POST | `/api/projects/{id}/vis/facets/{facet_id}/explain` | — | `{explanation}` |

### Edit History

| Method | Path | Query | Response |
|--------|------|-------|---------|
| GET | `/api/projects/{id}/edit-history` | `?document_id=&entity_type=&limit=&offset=` | EditEventOut[] |

### ICR

| Method | Path | Body / Query | Response |
|--------|------|-------------|---------|
| GET | `/api/projects/{id}/icr/overview` | — | ICROverview |
| GET | `/api/projects/{id}/icr/per-code` | — | ICRPerCode[] |
| GET | `/api/projects/{id}/icr/agreement-matrix` | — | AgreementMatrix |
| GET | `/api/projects/{id}/icr/disagreements` | filter params | Disagreement[] |
| POST | `/api/projects/{id}/icr/disagreements/{id}/resolve` | `{resolution_type, resolving_code_id?}` | 200 |

---

## 7. Key Algorithms & AI Components

### 7.1 3-Stage Audit Pipeline

Co-Refine implements a novel 3-stage audit pipeline that combines deterministic and AI-based assessment:

**Stage 1: Deterministic Scoring (no LLM)**

Runs immediately and without API cost. Provides the factual evidence base for Stage 2:
- **Centroid Similarity:** Compares the new segment's embedding against the running centroid of all past segments for this code. Range [0, 1]. A value below 0.65 indicates potential inconsistency.
- **Temporal Drift:** Computes cosine distance between the mean embedding of the researcher's oldest segments and newest segments for a code. Above 0.3 suggests semantic drift in how the code is being applied.
- **Segment Count:** Reports total segments, contextualises reliability of other scores (pseudo-centroid used if count < 3).

**Stage 2: LLM Audit (fast model)**

The LLM receives the full audit context — history, definitions, deterministic scores — and produces a structured verdict:
- `consistency_score` — constrained within ±0.15 of `centroid_similarity` to prevent hallucinated scores
- `intent_alignment_score` — purely semantic: does the segment match the code's intent?
- `overall_severity` — high/medium/low; inversely proportional to `consistency_score`
- Plain-language headline, finding, action item
- Alternative code suggestions if applicable

**Stage 3: Auto-Analysis (reasoning model)**

Triggered when a code reaches the `auto_analysis_threshold`. The reasoning model (`o1-mini`) synthesises an `AnalysisResult` from all existing segments:
- `definition` — operational definition inferred from pattern
- `lens` — analytical lens being applied
- `reasoning` — derivation trace

This is used in subsequent Stage 2 audits as `code_definitions` context, creating a feedback loop where the AI's understanding of the researcher's codes improves with each new segment.

### 7.2 Centroid Similarity

**Mathematical basis:** L2-normalized mean of all segment embeddings for a code forms the "centroid." Cosine similarity between a new segment's embedding and this centroid measures semantic alignment.

**Cold-start handling:** When fewer than `min_segments_for_consistency` (default: 3) segments exist, the centroid is computed from the code's definition text ("pseudo-centroid"). `is_pseudo_centroid: true` is surfaced to the researcher and to the LLM.

**Centroid update:** The centroid is not stored explicitly — it is recomputed on demand from all segment embeddings in ChromaDB. This ensures it always reflects the current state of the codebook.

### 7.3 Temporal Drift Detection

**Problem:** Researchers may gradually change how they interpret a code over time without realising it. This "concept drift" undermines coding consistency.

**Detection:** Divide the code's segments into oldest-N (N=5) and newest-N (N=5) by `created_at`. Compute the centroid of each group. Cosine distance between the two centroids quantifies drift.

**Interpretation:**
- 0.0–0.1: Very stable code definition over time
- 0.1–0.3: Minor drift, acceptable for evolving grounded theory
- 0.3+: Warning emitted; researcher should review earliest and latest segments

**Threshold:** Configurable per project via `ThresholdsTab`. Default: 0.3.

### 7.4 Code Overlap Detection

**Problem:** Researchers may create semantically redundant codes, splitting a single concept across two labels.

**Detection:** Compute pairwise cosine similarity between code centroids. High similarity (> 0.85) suggests the codes may be capturing the same concept.

**Output:** Symmetric matrix broadcast as `CODE_OVERLAP_MATRIX` via WebSocket. The `CodeOverlapTab` visualisation displays this as a heatmap. The `FlaggedPairs` component surfaces high-overlap pairs with merge suggestions.

### 7.5 Facet Clustering (KMeans + t-SNE)

**Problem:** A single code may contain distinct sub-patterns (facets) that the researcher has been applying inconsistently.

**Algorithm:**
1. Fetch all segment embeddings for a code from ChromaDB
2. Run KMeans with K ∈ {2, 3, 4}; select K with highest silhouette score
3. Run t-SNE (2D) on all segment embeddings for visualisation coordinates
4. Store t-SNE coordinates on `CodedSegment.tsne_x/tsne_y`
5. Create `Facet` records for each cluster centroid
6. LLM suggests short labels for each facet based on its segment texts

**Visualisation:** `FacetExplorerTab` renders a scatter plot of segments (positioned by t-SNE coords), coloured by facet. Clusters reveal sub-patterns in the code.

**Use case:** A researcher applies the code "Power" to both instances of institutional power and interpersonal power. Facet analysis reveals two clusters and suggests labels "Institutional Power" and "Interpersonal Power."

### 7.6 Inter-Coder Reliability Metrics

When multiple coders work on the same project, Co-Refine computes standard reliability metrics:

**Cohen's Kappa (κ):**
```
κ = (Po - Pe) / (1 - Pe)
```
- Po = observed agreement
- Pe = expected agreement by chance
- Interpretation: κ > 0.8 = strong agreement; κ > 0.6 = moderate

**Fleiss' Kappa:**
Generalisation of Cohen's kappa for more than 2 raters. Appropriate when K ≥ 3 coders.

**Krippendorff's Alpha:**
More general measure; handles missing data and multiple levels of measurement. Preferred for unbalanced coding designs.

---

## 8. Design Decisions & Rationale

### Vertical Slice Architecture (Backend)

Rather than a traditional horizontal layering (controllers → services → repositories → DB), Co-Refine uses **vertical slices**. Each feature (projects, documents, codes, segments, audit) owns its complete stack from HTTP to database queries. This:
- Minimises cross-feature coupling
- Makes each feature independently testable
- Enables feature-by-feature development without affecting other slices
- Reduces merge conflicts in a collaborative development setting

### Append-Only ConsistencyScore

`ConsistencyScore` records are never updated — each audit creates a new row. This:
- Enables trend analysis over time (consistency improving/degrading as the researcher codes more)
- Preserves historical evidence of past audit decisions
- Supports the `ConsistencyTimeline` visualisation
- Prevents accidental overwriting of historical data

### Per-User ChromaDB Collections

Segment embeddings are stored in per-user namespaced ChromaDB collections (`segments_user_{user_id}`). This:
- Isolates researchers' data in a multi-tenant deployment
- Enables per-user retrieval without cross-contamination
- Scales to multiple users on the same server instance

### Session Storage for Auth Tokens

Auth tokens are stored in `sessionStorage` rather than `localStorage`. This:
- Clears tokens when the browser tab is closed (important for research data security)
- Prevents tokens from persisting across different research sessions
- Aligns with the academic/institutional security context of the target users

### Zustand Slice Pattern

Global state is divided into 8 functionally cohesive slices rather than a monolithic store. This:
- Allows each feature to own its state logic
- Reduces re-render scope when a single slice updates
- Makes the store composition explicit and auditable
- Enables per-slice TypeScript interfaces

### Streaming Chat via WebSocket

Chat responses are streamed via WebSocket rather than polling or waiting for a complete response. This:
- Provides immediate visual feedback (streaming cursor)
- Avoids long-hanging HTTP connections
- Reuses the existing WebSocket infrastructure already needed for audit events
- Reduces perceived latency for the researcher

### LLM Score Grounding

The audit prompt explicitly constrains `consistency_score` to within ±0.15 of the deterministic `centroid_similarity`. This:
- Prevents the LLM from producing scores that contradict the embedding evidence
- Makes the LLM's role additive (semantic interpretation) rather than overriding (score invention)
- Maintains trust in the audit system — researchers can understand why a score was assigned

---

## 9. Security & Authentication

### JWT Authentication

- HMAC-SHA256 signed tokens with 7-day expiry (configurable)
- JWT secret auto-generated on first startup with a warning to set it explicitly
- Token carried in `Authorization: Bearer` header for all API calls
- WebSocket auth via `?token=` query parameter (4001 close on failure)

### Role-Based Access Control

- `ProjectMember` table tracks role per user per project: "owner" or "coder"
- Owner: full CRUD on project settings, members, codes, documents
- Coder: can create/delete their own segments; cannot modify settings or invite members
- Member check enforced at router level for all project-scoped endpoints

### Input Validation

- All request bodies validated by Pydantic v2 models
- File upload: size limits, MIME type checks, safe text extraction (no script execution)
- SQL injection: prevented by SQLAlchemy ORM (parameterised queries only)
- XSS: HTML content sanitised before storage; frontend uses `dangerouslySetInnerHTML` only for trusted server-generated annotated text

### Data Isolation

- All queries scoped by `project_id` or `user_id`
- Cross-project data access prevented at the repository layer
- ChromaDB collections namespaced per user

---

## 10. Accessibility

Co-Refine targets **WCAG 2.1 Level AA** compliance:

- **Keyboard navigation:** All interactive elements reachable by Tab. Toolbar implements arrow key navigation via `useToolbarKeyNav`. Modal dialogs implement focus traps.
- **ARIA labelling:** All icon-only buttons have `aria-label`. Icon SVGs have `aria-hidden="true"`. Modal dialogs have `role="dialog"` + `aria-modal="true"`.
- **Colour contrast:** Design tokens checked for AA contrast ratios in both light and dark mode.
- **Colour-independent information:** Severity badges show both colour AND text label. Code highlights include code label in `data-code-label` attribute for screen readers.
- **Automated testing:** `axe-core` (via `jest-axe`) runs in `*.a11y.test.tsx` colocated with components. Status bar and toolbar have dedicated a11y test files.

---

## 11. Testing Strategy

### Frontend Tests

| Type | Tool | Location | Purpose |
|------|------|----------|---------|
| Unit (component) | Vitest + RTL | `*.test.tsx` colocated | Component behaviour, user interactions |
| Unit (utility) | Vitest | `*.test.ts` colocated | Pure function correctness |
| Hook tests | Vitest + RTL | `*.test.ts` colocated | Custom hook logic |
| Accessibility | jest-axe | `*.a11y.test.tsx` colocated | WCAG compliance |
| End-to-end | Playwright | `e2e/` | Critical user flows |

**Test helper (`shared/__tests__/test-helpers.ts`):**
- `render()` wrapper: provides all Zustand providers
- `defaultStoreState`: factory for predictable test state
- Mock factories for all domain types

### Backend Tests

| Type | Tool | Location | Purpose |
|------|------|----------|---------|
| Unit | pytest | `backend/tests/` | Service + utility functions |
| Integration | pytest + TestClient | `backend/tests/features/` | Full router tests |
| Fixtures | conftest.py | `backend/tests/conftest.py` | In-memory SQLite, mock LLM, mock ChromaDB |

**Test isolation:** Each test uses an in-memory SQLite database and mocked LLM/ChromaDB clients. No external API calls are made in tests.

---

*End of Co-Refine System Documentation*
*Generated for dissertation purposes — 2026-03-10*
