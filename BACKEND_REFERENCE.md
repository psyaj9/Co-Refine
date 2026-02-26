# Backend & Agent Reference — Co-Refine

> **Complete developer reference** for the FastAPI backend, AI agents, prompt design, database schema, WebSocket protocol, and every request/response flow.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Configuration (`config.py`)](#2-configuration)
3. [Database Schema (`database.py`)](#3-database-schema)
4. [Application Entry Point (`main.py`)](#4-application-entry-point)
5. [REST API Routes](#5-rest-api-routes)
   - [Projects](#51-projects)
   - [Documents](#52-documents)
   - [Codes](#53-codes)
   - [Segments](#54-segments)
   - [Chat](#55-chat)
   - [Edit History](#56-edit-history)
6. [WebSocket Protocol](#6-websocket-protocol)
7. [AI Agents & Flows](#7-ai-agents--flows)
   - [Segment Creation Background Flow](#71-segment-creation-background-flow)
   - [Coding Audit Agent](#72-coding-audit-agent)
   - [Analysis Agent (Auto + Manual)](#73-analysis-agent-auto--manual)
   - [Batch Audit Agent](#74-batch-audit-agent)
   - [Chat Agent](#75-chat-agent)
8. [Prompt System](#8-prompt-system)
   - [Analysis Prompt](#81-analysis-prompt)
   - [Coding Audit Prompt](#82-coding-audit-prompt)
   - [Chat Prompt](#83-chat-prompt)
9. [Vector Store (`services/vector_store.py`)](#9-vector-store)
10. [LLM Client (`services/ai_analyzer.py`)](#10-llm-client)
11. [WebSocket Manager (`services/ws_manager.py`)](#11-websocket-manager)
12. [File Parser (`utils/file_parser.py`)](#12-file-parser)
13. [Pydantic Models (`models.py`)](#13-pydantic-models)
14. [Key Constants & Thresholds](#14-key-constants--thresholds)
15. [Full WebSocket Event Reference](#15-full-websocket-event-reference)
16. [End-to-End Request Flows](#16-end-to-end-request-flows)

---

## 1. Architecture Overview

```
Frontend (Vite/React, port 5173)
         │  REST + WebSocket
         ▼
FastAPI application (uvicorn, default port 8000)
├── Routers
│   ├── projects.py       → /api/projects/…
│   ├── documents.py      → /api/documents/…
│   ├── codes.py          → /api/codes/…
│   ├── segments.py       → /api/segments/…
│   ├── chat.py           → /api/chat/…
│   └── edit_history.py   → /api/projects/{id}/edit-history
├── WebSocket             → /ws/{user_id}
├── Services
│   ├── ai_analyzer.py    → Azure OpenAI wrapper + prompt runners
│   ├── vector_store.py   → ChromaDB (local sentence-transformers or Azure embeddings)
│   └── ws_manager.py     → Per-user WebSocket connection pool
├── Prompts
│   ├── analysis_prompt.py
│   ├── coding_audit_prompt.py
│   └── chat_prompt.py
├── Utils
│   └── file_parser.py    → .txt / .docx / .pdf text extraction
└── Persistence
    ├── SQLite (SQLAlchemy ORM) → inductive_lens.db
    └── ChromaDB              → ./chroma_data/
```

**Key design decisions:**
- All AI work runs in **FastAPI `BackgroundTasks`** (synchronous threads on the same process). They communicate results back to the browser exclusively through **WebSocket messages** — not HTTP responses.
- The main event loop is captured at startup and stored in `ws_manager` so background threads can safely schedule coroutines with `asyncio.run_coroutine_threadsafe`.
- The **reasoning model** is escalated to automatically when coding audit severity is `high` or the self-consistency score is below the configured threshold (`consistency_escalation_threshold`, default 0.7).

---

## 2. Configuration

**File:** `backend/config.py`  
Loaded from `.env` via `pydantic_settings.BaseSettings`.

| Setting | Default | Description |
|---|---|---|
| `app_title` | `"Co-Refine"` | FastAPI title |
| `azure_api_key` | `""` | Azure OpenAI key — **required for all AI features** |
| `azure_endpoint` | `""` | Azure OpenAI endpoint URL |
| `azure_api_version` | `""` | API version string |
| `azure_deployment_fast` | `""` | Deployment name used for coding audit (first pass) and chat |
| `azure_deployment_reasoning` | `""` | Deployment name used for analysis and high-severity audit escalation |
| `fast_model` | `"gpt-5-mini"` | Display label returned to UI |
| `reasoning_model` | `"gpt-5.2"` | Display label returned to UI |
| `embedding_model` | `"local"` | `"local"` → `all-MiniLM-L6-v2` via sentence-transformers; anything else → Azure embeddings API |
| `min_segments_for_consistency` | `3` | (Unused directly — kept as config) |
| `auto_analysis_threshold` | `3` | Segment count required to trigger auto-analysis |
| `vector_search_top_k` | `8` | Default number of results from vector similarity search |
| `consistency_escalation_threshold` | `0.7` | If self-consistency numeric score < this, escalate to reasoning model |
| `database_url` | `"sqlite:///./inductive_lens.db"` | SQLAlchemy DB URL |
| `chroma_persist_dir` | `"./chroma_data"` | ChromaDB persistence directory |

**`settings.azure_api_key` is the primary feature flag.** If empty, agents are skipped and chat returns 503.

---

## 3. Database Schema

**File:** `backend/database.py`  
SQLite via SQLAlchemy ORM. Tables created automatically by `init_db()` on startup.

### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | String PK | UUID |
| `name` | String | |
| `created_at` | DateTime | UTC |

Cascade deletes: `documents`, `codes`.

### `documents`
| Column | Type | Notes |
|---|---|---|
| `id` | String PK | UUID |
| `project_id` | FK → projects | |
| `title` | String | |
| `full_text` | Text | Normalised to `\n` line endings |
| `doc_type` | String | `"transcript"` default |
| `html_content` | Text nullable | Rich HTML from mammoth (DOCX only) |
| `original_filename` | String nullable | |
| `created_at` | DateTime | UTC |

Cascade deletes: `coded_segments`.

### `codes`
| Column | Type | Notes |
|---|---|---|
| `id` | String PK | UUID |
| `project_id` | FK → projects | |
| `label` | String | Must be unique per project |
| `definition` | Text nullable | Researcher-supplied definition |
| `colour` | String | Hex colour, default `#FFEB3B` |
| `created_by` | String | user_id |
| `created_at` | DateTime | UTC |

Cascade deletes: `coded_segments`, `analysis_results`.

### `coded_segments`
| Column | Type | Notes |
|---|---|---|
| `id` | String PK | UUID |
| `document_id` | FK → documents | |
| `text` | Text | The actual highlighted text |
| `start_index` | Integer | Character offset into `document.full_text` |
| `end_index` | Integer | Character offset |
| `code_id` | FK → codes | |
| `user_id` | String | |
| `created_at` | DateTime | UTC |

Cascade deletes: `agent_alerts`.

### `analysis_results`
| Column | Type | Notes |
|---|---|---|
| `id` | String PK | UUID |
| `code_id` | FK → codes | One-to-one per code (upserted) |
| `definition` | Text nullable | AI-inferred definition |
| `lens` | Text nullable | AI-inferred interpretive lens |
| `reasoning` | Text nullable | AI step-by-step reasoning |
| `segment_count_at_analysis` | Integer | How many segments were used |
| `created_at` | DateTime | UTC |

### `agent_alerts`
| Column | Type | Notes |
|---|---|---|
| `id` | String PK | UUID |
| `user_id` | String | Scoped per user |
| `segment_id` | FK → coded_segments nullable | |
| `alert_type` | String | e.g. `"coding_audit"` |
| `payload` | JSON | Full agent result (self_lens + inter_rater_lens + overall_severity) |
| `is_read` | Boolean | Default `False` |
| `created_at` | DateTime | UTC |

### `chat_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | String PK | UUID |
| `conversation_id` | String indexed | Groups messages |
| `project_id` | FK → projects | |
| `user_id` | String | |
| `role` | String | `"user"` or `"assistant"` |
| `content` | Text | |
| `created_at` | DateTime | UTC |

### `edit_events`
| Column | Type | Notes |
|---|---|---|
| `id` | String PK | UUID |
| `project_id` | FK → projects indexed | |
| `document_id` | FK → documents nullable | |
| `entity_type` | String | `"segment"` or `"code"` |
| `action` | String | `"created"`, `"updated"`, `"deleted"` |
| `entity_id` | String | ID of the segment or code |
| `field_changed` | String nullable | e.g. `"label"`, `"definition"`, `"colour"` |
| `old_value` | Text nullable | Previous value (code updates only) |
| `new_value` | Text nullable | New value (code updates only) |
| `metadata_json` | JSON nullable | Snapshot context at time of event |
| `user_id` | String | |
| `created_at` | DateTime | UTC |

---

## 4. Application Entry Point

**File:** `backend/main.py`

### Lifespan
On startup:
1. Calls `init_db()` — creates all SQLAlchemy tables if they don't exist.
2. Calls `ws_manager.set_loop(asyncio.get_event_loop())` — stores the running event loop so background threads can safely schedule WebSocket sends.

### CORS
Allowed origins: `http://localhost:5173`, `http://127.0.0.1:5173`.  
All methods and headers allowed.

### Routers mounted
- `GET /api/health` → `{"status": "ok", "title": "..."}`
- `GET /api/settings` → `{"has_api_key": bool, "fast_model": str, "reasoning_model": str, "embedding_model": str}`
- `WS /ws/{user_id}` → WebSocket endpoint (see §6)
- All routers from `routers/`

---

## 5. REST API Routes

### 5.1 Projects

**Prefix:** `/api/projects`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create project. Body: `{name}`. Returns `ProjectOut`. |
| `GET` | `/` | List all projects (newest first). Returns `ProjectOut[]`. |
| `GET` | `/{project_id}` | Get single project. |
| `DELETE` | `/{project_id}?user_id=` | Delete project + all documents, codes, segments, vector embeddings. Cascade is handled manually (deletes embeddings from Chroma before SQLAlchemy cascade). |

`ProjectOut` includes computed `document_count` and `code_count`.

---

### 5.2 Documents

**Prefix:** `/api/documents`

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload` | Multipart upload. Fields: `file`, `title`, `doc_type`, `project_id`. Extracts text + HTML. Returns `DocumentUploadResponse`. |
| `POST` | `/paste` | Form fields: `title`, `text`, `doc_type`, `project_id`. Creates document from pasted plain text. |
| `GET` | `/` | List documents. Optional query: `?project_id=`. Returns `DocumentOut[]`. |
| `GET` | `/{doc_id}` | Get single document with full text. |
| `DELETE` | `/{doc_id}?user_id=` | Delete document + its segments' vector embeddings + alerts. |

Supported upload formats: `.txt`, `.docx`, `.pdf`.  
DOCX files also extract `html_content` via `mammoth` for rich rendering.  
Line endings are normalised to `\n`.

---

### 5.3 Codes

**Prefix:** `/api/codes`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create code. Body: `{label, definition?, colour?, user_id, project_id}`. Label must be unique per project (409 if duplicate). Records `EditEvent(action="created")`. |
| `GET` | `/` | List codes. Optional `?project_id=`. Sorted alphabetically. Each includes `segment_count`. |
| `PATCH` | `/{code_id}` | Update label/definition/colour. Records one `EditEvent(action="updated")` per changed field with `old_value`/`new_value`. |
| `DELETE` | `/{code_id}?user_id=` | Delete code + all its segments (+ their embeddings + alerts) + analysis results. Records `EditEvent(action="deleted")`. |
| `GET` | `/{code_id}/segments` | Get all segments for a code (by user_id). |

---

### 5.4 Segments

**Prefix:** `/api/segments`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create segment. Triggers background agents if API key configured. |
| `GET` | `/` | List segments. Optional `?document_id=&user_id=`. Uses single JOIN query (no N+1). |
| `GET` | `/{segment_id}` | Get single segment. |
| `DELETE` | `/{segment_id}?user_id=` | Delete segment + vector embedding. Records `EditEvent`. |
| `POST` | `/analyze` | Manually trigger analysis for a code. Body: `{code_id, user_id}`. Requires ≥2 segments. |
| `GET` | `/analyses` | List all `AnalysisResult` records. Optional `?project_id=`. |
| `GET` | `/alerts` | List agent alerts for a user. Query: `?user_id=&unread_only=true`. Limit 50, newest first. |
| `PATCH` | `/alerts/{alert_id}/read` | Mark alert as read. |
| `POST` | `/batch-audit` | Run Coding Audit on all codes in a project. Body: `{project_id, user_id}`. Requires API key. |

**Segment creation flow** (simplified):
1. Validate code + document exist.
2. Insert `CodedSegment` into DB.
3. Record `EditEvent(action="created")`.
4. If `settings.azure_api_key` set → schedule `_run_background_agents(...)` as `BackgroundTask`.
5. Return `SegmentOut` immediately (the HTTP response does NOT wait for agents).

---

### 5.5 Chat

**Prefix:** `/api/chat`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Send message. Body: `{message, project_id, user_id, conversation_id?}`. Returns immediately with `{conversation_id, status: "streaming"}`. Streams via WebSocket. |
| `GET` | `/history/{conversation_id}` | Full message list for a conversation. |
| `GET` | `/conversations?project_id=&user_id=` | List last 20 conversations with preview. |
| `DELETE` | `/conversations/{conversation_id}` | Delete all messages in a conversation. |

**Chat flow:**
1. Persist user message.
2. Build codebook context (all project codes + their AI analyses).
3. Semantic search over user's segments for the query text (top 8).
4. Fetch prior messages in this conversation (last 20).
5. Schedule `_stream_response_background(...)` as `BackgroundTask`.
6. Return `{conversation_id, status: "streaming"}`.
7. Background: build prompt → stream LLM tokens → send each via WS `chat_token` event → send `chat_done` → persist assistant message.

---

### 5.6 Edit History

**Prefix:** `/api/projects/{project_id}/edit-history`

| Method | Path | Description |
|---|---|---|
| `GET` | `/edit-history` | Return edit events for a project. Newest first. Filters: `?document_id=&entity_type=&limit=200&offset=0`. |

---

## 6. WebSocket Protocol

**Endpoint:** `ws://localhost:8000/ws/{user_id}`

The client connects once per user session. The server sends all agent updates / stream tokens over this connection. The client currently only keeps the socket alive (sends any text to prevent timeout); the server does not act on received messages.

**Connection lifecycle:**
- `connect()` → accept, register in `ws_manager._connections[user_id]`
- `WebSocketDisconnect` → `disconnect()`, cleanup
- Multiple tabs/connections per `user_id` are supported (stored as a `set`)

All messages are JSON objects with at minimum a `"type"` field. See [§15](#15-full-websocket-event-reference) for the complete event catalogue.

---

## 7. AI Agents & Flows

There are **three AI agents** in this system:
1. **Coding Audit Agent** — runs on every new segment
2. **Analysis Agent** — runs auto on every new segment (if threshold met); manual-trigger also available
3. **Chat Agent** — runs on every chat message (streaming)

All agents run in background threads. Results are pushed to the frontend exclusively via WebSocket.

---

### 7.1 Segment Creation Background Flow

**Triggered by:** `POST /api/segments/` when `settings.azure_api_key` is set.  
**Function:** `_run_background_agents(...)` in `routers/segments.py`

```
HTTP POST /api/segments/
      │ (immediate 200 response)
      └── BackgroundTask: _run_background_agents
            │
            ├─ WS: agents_started
            │
            ├─ Step 1: Embed segment
            │   └── add_segment_embedding(user_id, segment_id, text, code_label, ...)
            │       → ChromaDB upsert with all-MiniLM-L6-v2 embedding
            │
            ├─ Step 2: Coding Audit Agent
            │   ├─ WS: agent_thinking (agent="coding_audit")
            │   ├─ find_diverse_segments(user_id, query=text, code_filter=code_label, n=10) → MMR sampling
            │   ├─ Load all AnalysisResults for context
            │   ├─ run_coding_audit(history, code_definitions, new_quote, proposed_code, ...)
            │   │   ├─ First call: azure_deployment_fast
            │   │   └─ Escalate to azure_deployment_reasoning if severity==high OR score < threshold
            │   ├─ Post-process: filter alternative_codes already on this span
            │   ├─ Post-process: set is_conflict=False if predicted code already on span
            │   ├─ Persist AgentAlert (alert_type="coding_audit")
            │   └─ WS: coding_audit
            │
            ├─ Step 3: Auto-Analysis (conditional)
            │   Condition: segment_count ≥ auto_analysis_threshold (3)
            │              AND (count - last_count ≥ threshold OR no prior analysis)
            │   ├─ WS: agent_thinking (agent="analysis")
            │   ├─ analyze_quotes(code_label, all_quotes, user_definition)
            │   │   └─ Always uses azure_deployment_reasoning
            │   ├─ Persist/upsert AnalysisResult
            │   └─ WS: analysis_updated
            │
            └─ WS: agents_done
```

**Context window helper (`_extract_window`):**  
Extracts 2 sentences before and after the highlighted span, formatted as:
```
...preceding context >>>HIGHLIGHTED TEXT<<< following context...
```
This context is passed to the Coding Audit prompt.

**Co-applied codes detection:**  
Before the audit, the backend queries for all other `CodedSegment` rows on the same document where the character spans overlap (`start_index < end_index AND end_index > start_index`). These existing codes are excluded from `alternative_codes` suggestions and their presence suppresses `is_conflict` on the inter-rater result.

---

### 7.2 Coding Audit Agent

**Function:** `run_coding_audit(...)` in `services/ai_analyzer.py`  
**Prompt:** `build_coding_audit_prompt(...)` in `prompts/coding_audit_prompt.py`

**Inputs:**
- `user_history`: list of `(code_label, text)` tuples — diverse past coding decisions for context (MMR-sampled from ChromaDB)
- `code_definitions`: dict of `code_label → {definition, lens}` from `AnalysisResult` table (AI-inferred)
- `new_quote`: text of the new segment
- `proposed_code`: label of the code the researcher applied
- `document_context`: surrounding text window (2 sentences before/after)
- `user_code_definitions`: dict of `code_label → researcher_definition` from the `Code` table
- `existing_codes_on_span`: list of other code labels already on this text span

**LLM call strategy:**
1. First call: `azure_deployment_fast` (cheaper/faster)
2. If `overall_severity == "high"` OR `self_lens.consistency_score` maps to numeric < `consistency_escalation_threshold` (0.7): escalate to `azure_deployment_reasoning`

**Output JSON structure:**
```json
{
  "self_lens": {
    "is_consistent": true,
    "consistency_score": "high|medium|low",
    "reasoning": "...",
    "definition_match": "...",
    "drift_warning": "...",
    "alternative_codes": ["..."],
    "suggestion": "..."
  },
  "inter_rater_lens": {
    "predicted_code": "...",
    "confidence": "high|medium|low",
    "is_conflict": false,
    "reasoning": "...",
    "conflict_explanation": "..."
  },
  "overall_severity": "high|medium|low"
}
```

**Post-processing (done in router, not service):**
- `alternative_codes` filtered to only codes that exist in the project codebook
- `alternative_codes` filtered to exclude codes already on this span
- `is_conflict` forced to `False` if `predicted_code` already applied to this span

---

### 7.3 Analysis Agent (Auto + Manual)

**Auto trigger condition:**  
`code_segment_count >= auto_analysis_threshold (3) AND (count - last_count >= threshold OR last_count == 0)`

In practice: analysis runs on the 3rd segment, then next time when another 3 segments have been added since the last analysis.

**Manual trigger:** `POST /api/segments/analyze` → calls `_run_analysis_background(...)`.

**Function:** `analyze_quotes(...)` in `services/ai_analyzer.py`  
**LLM:** Always uses `azure_deployment_reasoning` (no fast-model fallback).  
**Prompt:** `build_analysis_prompt(...)` in `prompts/analysis_prompt.py`

**Inputs:**
- `code_label`: the code being analysed
- `quotes`: all segment texts for this code + user
- `user_definition` (optional): researcher's own definition from `Code.definition`

**Output JSON structure:**
```json
{
  "definition": "AI-inferred operational definition",
  "lens": "Interpretive framework the researcher appears to be using",
  "reasoning": "Step-by-step explanation (may be a list or string)"
}
```

**Parse failure handling:**  
If the LLM returns unparseable JSON, `parse_json_response` returns `{"definition": PARSE_FAILED_SENTINEL}`. In this case, the old `AnalysisResult` is **not** overwritten — the error is reported to the frontend via `agent_error` WS event.

**Persistence:** Upserts `AnalysisResult` (uses `db.merge()` which UPSERT-by-primary-key). Stores `reasoning` as joined string if the LLM returns a list.

---

### 7.4 Batch Audit Agent

**Trigger:** `POST /api/segments/batch-audit` with `{project_id, user_id}`  
**Function:** `_run_batch_audit_background(...)` in `routers/segments.py`

For each code in the project:
1. Use `find_diverse_segments(user_id, query=code_label, code_filter=code_label, n=15)` to get MMR-diverse representatives.
2. The **first** result (most query-relevant) is the "candidate" being audited.
3. The rest become the history context.
4. Calls `run_coding_audit(...)` — same function as per-segment audit.
5. Filters `alternative_codes` to only codebook-existing codes.
6. Persists `AgentAlert`.
7. Sends `coding_audit` WS event with `batch: true`.
8. Sends `batch_audit_progress` WS event after each code.

If a code has no segments in Chroma, emits a `batch_audit_progress` event with `skipped: true`.

Begins with `batch_audit_started {total_codes}` and ends with `batch_audit_done`.

---

### 7.5 Chat Agent

**Trigger:** `POST /api/chat/` → `_stream_response_background(...)`

**Context injected into the prompt:**
1. **Codebook** — all codes in the project with: user definition, AI-inferred definition, AI lens, segment count.
2. **Retrieved segments** — top-8 semantically similar segments from ChromaDB for the user's query (cross-code search).
3. **Conversation history** — last 20 messages in the conversation.

**LLM:** `azure_deployment_fast`, streaming enabled (`stream=True`).

**Token streaming via WebSocket:**
- `chat_stream_start` — notify start
- `chat_token` (one per yielded chunk) — incremental token
- `chat_done` — streaming complete
- `chat_error` — on exception

After all tokens received, the full response is persisted as `ChatMessage(role="assistant")`.

---

## 8. Prompt System

### 8.1 Analysis Prompt

**File:** `backend/prompts/analysis_prompt.py`

**Role the LLM is given:** Expert Qualitative Researcher specialising in thematic analysis.

**Task:** Review tagged quotes for a code label; infer:
1. The latent theme connecting them.
2. The operational definition the researcher is implicitly applying.
3. Comparison with researcher's stated definition (if provided).
4. The "Interpretive Lens" — the perspective behind the selections.

**Researcher definition handling:**
- If provided: "Use this as the baseline — identify how actual coding patterns align with, extend, or diverge from it."
- If not provided: "Infer the definition entirely from the coding patterns."

**Expected JSON output keys:** `definition`, `lens`, `reasoning`

---

### 8.2 Coding Audit Prompt

**File:** `backend/prompts/coding_audit_prompt.py`

**Role the LLM is given:** Expert Qualitative Research Auditor.

**Two simultaneous lenses:**

**Lens 1 — Self-Consistency:**
- Does the segment match the researcher's own definition of the proposed code?
- Compare against coding history for drift/inconsistency.
- Are better-fitting codes available (excluding already-applied ones)?

**Lens 2 — Inter-Rater Reliability:**
- What code would an independent second researcher assign?
- Does it differ from the proposed code AND all codes already on this span?
- Flag as conflict if so.

**Priority hierarchy in the prompt:**
1. Researcher-supplied definitions (canonical, `user_code_definitions`)
2. AI-inferred definitions (supplementary, `code_definitions` from AnalysisResult)

**The `co_applied_label_list`** is injected as an explicit constraint: "NEVER include these in alternative_codes".

**Document context** is injected with `>>>` markers on the highlighted span.

**History format:**
```
  - Code: "label" → "first 200 chars of segment..."
```

---

### 8.3 Chat Prompt

**File:** `backend/prompts/chat_prompt.py`

**System prompt** instructs the LLM to:
- Reference specific codes and segments when relevant.
- Help identify patterns, compare codes, spot drift, reflect.
- Be concise using bullet points.
- Never fabricate segments or codes.

**Context injection** (as a second `system` message):
```markdown
## Codebook
- **CodeLabel** — User definition: "..." | AI-inferred: "..." | Lens: "..." (N segments)

## Relevant Coded Segments
- [CodeLabel] "first 200 chars of segment text"
```

Up to 10 retrieved segments are included. Last 20 conversation turns are replayed in order.

---

## 9. Vector Store

**File:** `backend/services/vector_store.py`  
**Storage:** ChromaDB `PersistentClient` at `./chroma_data`.  
**Collection naming:** `segments_{user_id}` — one collection per user.  
**Distance metric:** Cosine (`hnsw:space: cosine`).

### Embedding Strategy

| `embedding_model` setting | Method |
|---|---|
| `"local"` (default) | `sentence-transformers/all-MiniLM-L6-v2` loaded lazily, thread-safe singleton |
| Anything else | Azure OpenAI Embeddings API |

### Functions

**`add_segment_embedding(user_id, segment_id, text, code_label, document_id, created_at?)`**  
Upserts a segment into Chroma with metadata: `{code, document_id, text_preview, created_at}`.

**`find_similar_segments(user_id, query_text, top_k?, code_filter?)`**  
Standard cosine similarity search. Optional `code_filter` applies a Chroma `where` clause on the `code` metadata field.

**`find_similar_across_codes(user_id, query_text, top_k?)`**  
Alias for `find_similar_segments` with no code filter — used by the chat retrieval.

**`find_diverse_segments(user_id, query_text, code_filter?, n=15, lambda_mmr=0.5)`**  
**Maximal Marginal Relevance (MMR)** sampling. Returns up to `n` segments that balance:
- Relevance to the query: `lambda_mmr * cosine_sim(query, candidate)`
- Diversity from already-selected: `- (1 - lambda_mmr) * max_cosine_sim(candidate, selected)`

MMR score at each step: `λ·sim(query, cand) − (1−λ)·max_sim(cand, already_selected)`

Used by both the per-segment audit (history context, n=10) and batch audit (n=15).

**`delete_segment_embedding(user_id, segment_id)`**  
Deletes a document from the user's Chroma collection. Called on segment and code deletion.

---

## 10. LLM Client

**File:** `backend/services/ai_analyzer.py`  
**Client:** `openai.AzureOpenAI` — lazy singleton, reused across all calls.

### `_call_llm(prompt, model?, retries=1)`

- Always requests `response_format={"type": "json_object"}`.
- Retries once on parse failure.
- Returns the parsed dict; if both attempts fail, returns the sentinel result.

### `analyze_quotes(code_label, quotes, user_definition?)`

Calls `build_analysis_prompt` then `_call_llm` with `azure_deployment_reasoning`.

### `run_coding_audit(...)`

Calls `build_coding_audit_prompt` then:
1. `_call_llm` with `azure_deployment_fast`
2. Checks severity and score; escalates to `azure_deployment_reasoning` if needed

### `stream_chat_response(messages, model?)`

Generator function. Calls `chat.completions.create(stream=True)` and yields `delta.content` for each chunk.

### Parse Failure Sentinel

`PARSE_FAILED_SENTINEL = "__PARSE_FAILED__"` (defined in `utils/__init__.py`).  
When `parse_json_response` cannot decode the LLM output, it returns `{"definition": PARSE_FAILED_SENTINEL}`. All consumers check for this before persisting.

---

## 11. WebSocket Manager

**File:** `backend/services/ws_manager.py`  
**Singleton:** `ws_manager` imported across the app.

```python
class ConnectionManager:
    _connections: dict[str, set[WebSocket]]  # user_id → set of live connections
    _loop: asyncio.AbstractEventLoop          # captured at startup
```

### Thread Safety

Background threads cannot `await` directly. They call:
```python
ws_manager.send_alert_threadsafe(user_id, payload)
# → asyncio.run_coroutine_threadsafe(send_alert(user_id, payload), self._loop)
```

This schedules the coroutine on the main event loop from any thread.

### Dead Connection Cleanup

`send_alert(user_id, alert)` collects any sockets that raise on `send_json` and removes them from the set.

---

## 12. File Parser

**File:** `backend/utils/file_parser.py`

| Extension | Text extraction | HTML extraction |
|---|---|---|
| `.txt` | UTF-8 decode (errors replaced) | None |
| `.docx` | `python-docx` paragraph join | `mammoth.convert_to_html` (if available) |
| `.pdf` | `pypdf` page text join | None |

All libraries are optional (try/import). If missing, extraction returns `None` and the router raises 400.

---

## 13. Pydantic Models

**File:** `backend/models.py`

| Model | Used for |
|---|---|
| `ProjectCreate` | POST /projects body |
| `ProjectOut` | project responses |
| `DocumentUploadResponse` | upload/paste response |
| `DocumentOut` | document responses |
| `CodeCreate` | POST /codes body |
| `CodeOut` | code responses (includes `segment_count`) |
| `CodeUpdate` | PATCH /codes/{id} body (all fields optional) |
| `SegmentCreate` | POST /segments body |
| `SegmentOut` | segment responses (includes `code_label`, `code_colour`) |
| `AnalysisOut` | analysis responses |
| `AnalysisTrigger` | POST /segments/analyze body |
| `BatchAuditRequest` | POST /segments/batch-audit body |
| `AlertOut` | alert responses |
| `ChatRequest` | POST /chat body |
| `ChatMessageOut` | chat history responses |
| `EditEventOut` | edit history responses |

---

## 14. Key Constants & Thresholds

| Constant | Value | Effect |
|---|---|---|
| `auto_analysis_threshold` | 3 | Analysis runs when `code_segment_count ≥ 3` and has grown by ≥3 since last analysis |
| `consistency_escalation_threshold` | 0.7 | Audit escalated to reasoning model if `self_lens.consistency_score` maps below this |
| `vector_search_top_k` | 8 | Default results from similarity search (chat retrieval) |
| MMR `n` for per-segment audit | 10 | Number of diverse history segments for coding audit |
| MMR `n` for batch audit | 15 | Number of diverse history segments for batch audit |
| MMR `lambda_mmr` | 0.5 | Balance between relevance and diversity (equal weight) |
| Chat history window | 20 | Last N messages replayed in chat prompt |
| Chat retrieved segments | 8 | Top-k from semantic search for chat context |
| Alert fetch limit | 50 | Max unread alerts returned |

---

## 15. Full WebSocket Event Reference

All events are JSON. Client receives these; client does not send structured events (only keep-alive text).

### Agent Lifecycle Events

| Event type | Payload fields | Sent when |
|---|---|---|
| `agents_started` | `segment_id?`, `data: {source?}` | Background agent pipeline begins for a segment |
| `agent_thinking` | `agent`, `segment_id?`, `data: {}` | Before each agent call (coding_audit, analysis) |
| `agent_error` | `agent`, `segment_id?`, `data: {message}` | Agent threw an exception or returned a parse failure |
| `agents_done` | `segment_id?`, `data: {}` | All agents finished for a segment |

### Coding Audit Events

| Event type | Payload fields | Sent when |
|---|---|---|
| `coding_audit` | `segment_id`, `segment_text`, `code_id`, `code_label`, `is_consistent`, `is_conflict`, `batch?`, `data: {self_lens, inter_rater_lens, overall_severity}` | Audit complete (per-segment or batch) |

### Analysis Events

| Event type | Payload fields | Sent when |
|---|---|---|
| `analysis_updated` | `code_id`, `code_label`, `data: {definition, lens, reasoning}` | Analysis upserted to DB |

### Batch Audit Events

| Event type | Payload fields | Sent when |
|---|---|---|
| `batch_audit_started` | `data: {total_codes}` | Batch audit begins |
| `batch_audit_progress` | `data: {completed, total, code_label, skipped?}` | After each code processed |
| `batch_audit_done` | `data: {total_codes, error?}` | Batch complete (or errored) |

### Chat Events

| Event type | Payload fields | Sent when |
|---|---|---|
| `chat_stream_start` | `conversation_id`, `data: {}` | LLM starts streaming |
| `chat_token` | `conversation_id`, `token`, `data: {}` | Each streamed text chunk |
| `chat_done` | `conversation_id`, `data: {}` | Streaming complete |
| `chat_error` | `conversation_id`, `data: {message}` | Exception during streaming |

---

## 16. End-to-End Request Flows

### Flow A: User highlights text and applies a code

```
1. Frontend: POST /api/segments/
   Body: { document_id, text, start_index, end_index, code_id, user_id }

2. Backend (synchronous):
   a. Insert CodedSegment → DB
   b. Insert EditEvent(action="created") → DB
   c. Schedule _run_background_agents as BackgroundTask
   d. Return SegmentOut (HTTP 200)

3. Backend (background thread, _run_background_agents):
   a. WS → agents_started
   b. Embed segment text → ChromaDB upsert
   c. Query overlapping segments on same span (co-applied codes)
   d. WS → agent_thinking (coding_audit)
   e. MMR sample 10 diverse segments for history
   f. Load AnalysisResults for code_definitions
   g. Build coding audit prompt + call LLM (fast model)
   h. If high severity or low score → re-call (reasoning model)
   i. Post-process: filter alternatives, check is_conflict
   j. Insert AgentAlert → DB
   k. WS → coding_audit
   l. Check auto-analysis threshold
   m. If threshold met:
      - WS → agent_thinking (analysis)
      - Call analyze_quotes (reasoning model)
      - Upsert AnalysisResult → DB
      - WS → analysis_updated
   n. WS → agents_done
```

### Flow B: User sends a chat message

```
1. Frontend: POST /api/chat/
   Body: { message, project_id, user_id, conversation_id? }
   → Returns: { conversation_id, status: "streaming" }

2. Backend (synchronous):
   a. Persist ChatMessage(role="user")
   b. Build codebook from all project codes + AnalysisResults
   c. Semantic search: find_similar_across_codes(user_id, message) → top 8
   d. Load conversation history
   e. Schedule _stream_response_background as BackgroundTask

3. Backend (background thread):
   a. WS → chat_stream_start
   b. Build messages list (system + context + history + user message)
   c. stream_chat_response(messages) → generator
   d. For each token chunk:
      WS → chat_token { token }
   e. WS → chat_done
   f. Persist ChatMessage(role="assistant", content=full_response)
```

### Flow C: User triggers batch audit

```
1. Frontend: POST /api/segments/batch-audit
   Body: { project_id, user_id }
   → Returns: { status: "batch_audit_started", code_count: N }

2. Backend (background thread, _run_batch_audit_background):
   a. WS → batch_audit_started { total_codes }
   b. Build shared context: user_code_definitions + code_definitions
   c. For each code in project:
      i.  find_diverse_segments(user_id, code_label, code_filter=code_label, n=15)
      ii. If no segments → WS batch_audit_progress (skipped=true) → continue
      iii. Run coding_audit on representative segment
      iv. Filter alternative_codes to codebook
      v.  Persist AgentAlert
      vi. WS → coding_audit { batch: true }
      vii. WS → batch_audit_progress
   d. WS → batch_audit_done
```

### Flow D: User manually re-runs analysis

```
1. Frontend: POST /api/segments/analyze
   Body: { code_id, user_id }
   Requires ≥ 2 segments (otherwise 400)
   → Returns: { status: "analysis_started", code_id }

2. Backend (background thread, _run_analysis_background):
   a. WS → agents_started { source: "manual_analysis" }
   b. WS → agent_thinking (analysis)
   c. Load all segment texts for code + user
   d. Call analyze_quotes (reasoning model)
   e. If parse failure → WS agent_error, abort (don't overwrite existing analysis)
   f. Upsert AnalysisResult → DB
   g. WS → analysis_updated
   h. WS → agents_done
```

---

*Last updated: February 2026*
