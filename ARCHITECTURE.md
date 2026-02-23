# Co-Refine Backend Architecture

An agentic qualitative coding system powered by Google Gemini models via the OpenAI-compatible API. Three AI agents provide real-time feedback on researcher coding decisions: consistency checking, inter-rater simulation, and automated inductive analysis.

---

## Table of Contents

- [System Overview](#system-overview)
- [Agentic Architecture](#agentic-architecture)
  - [Agent 1: Self-Consistency Checker](#agent-1-self-consistency-checker)
  - [Agent 2: Ghost Partner](#agent-2-ghost-partner)
  - [Agent 3: Inductive Analysis](#agent-3-inductive-analysis)
- [Model Selection & Tiering](#model-selection--tiering)
- [API Integration](#api-integration)
- [Embedding & Vector Search](#embedding--vector-search)
- [Windowed Context](#windowed-context)
- [Data Flow](#data-flow)
- [Key Optimizations](#key-optimizations)
- [Suggested Improvements](#suggested-improvements)
- [File Reference](#file-reference)

---

## System Overview

```
User highlights & codes a segment
        │
        ▼
┌──── POST /api/segments/ ──────────────────────────────────┐
│  1. Save segment to SQLite                               │
│  2. If GEMINI_API_KEY is set:                            │
│     Schedule background agents asynchronously:           │
│     ├─ Embed segment → ChromaDB                          │
│     ├─ Self-Consistency check (if ≥3 segments exist)    │
│     ├─ Ghost Partner simulation                          │
│     └─ Auto-Analysis (if threshold met)                 │
│  3. Return segment_id immediately (non-blocking)         │
└─────────────────────────────────────────────────────────┘
        │
        ▼  (background, in thread pool)
┌─────────────────────────────────────────────────────────┐
│  Each agent runs sequentially, WebSocket alerts stream  │
│  in real-time. Agents emit:                             │
│  • agents_started                                        │
│  • agent_thinking (per agent)                           │
│  • consistency / ghost_partner / analysis_updated       │
│  • agents_done                                          │
└─────────────────────────────────────────────────────────┘
```

**Key detail**: Background agents run in FastAPI's thread pool (not async), but WebSocket messages are sent safely from the background thread to the main event loop via `asyncio.run_coroutine_threadsafe()`. This avoids the `RuntimeError: This event loop is already running` crash.

---

## Agentic Architecture

### Agent 1: Self-Consistency Checker

**Purpose**: Flag when a new coding decision deviates from the researcher's established patterns.

**Process**:
1. Query ChromaDB for the top-8 most similar segments (by cosine similarity)
2. Load AI-inferred code definitions from prior analyses
3. Build a prompt with the new segment, similar history, and existing definitions
4. Call `gemini-2.0-flash` (fast model, 1500 free req/day)
5. If consistency score < 0.7, **escalate** to `gemini-2.5-flash` (reasoning model, 500 free req/day)
6. Persist alert to `agent_alerts` table
7. Push `consistency` WebSocket message with partial/full reasoning

**Prompt** ([backend/prompts/self_consistency_prompt.py](backend/prompts/self_consistency_prompt.py)):
- Two-tier definitions: researcher-supplied (canonical) + AI-inferred (supplementary)
- Similar segments with their codes and text
- Request: `{is_consistent, consistency_score, reasoning, definition_match, lens_alignment, alternative_codes, drift_warning, suggestion}`

**Trigger condition**: Only when user has ≥3 existing segments (configurable: `MIN_SEGMENTS_FOR_CONSISTENCY`). Prevents noise during initial coding.

---

### Agent 2: Ghost Partner

**Purpose**: Simulate an independent second coder to detect inter-rater conflicts.

**Process**:
1. Retrieve top-8 similar segments from the user's own history (vector search)
2. Extract windowed document context (~2 sentences before/after highlight)
3. Build prompt with document context, the highlighted text, and the user's prior codings
4. Call `gemini-2.0-flash` to predict what an independent coder would choose
5. Compare prediction vs. actual code; if mismatch, flag as conflict
6. Persist alert; push `ghost_partner` WebSocket message

**Prompt** ([backend/prompts/ghost_partner_prompt.py](backend/prompts/ghost_partner_prompt.py)):
- Full codebook with existing segment counts per code
- Highlighted text marked with `>>>...<<<` delimiters
- Document context above/below
- Request: `{predicted_code, confidence, is_conflict, reasoning, conflict_explanation}`

**Known limitation**: The ghost receives the same researcher's own history, not a truly independent second coder. See [Suggested Improvements](#suggested-improvements) for solutions.

---

### Agent 3: Inductive Analysis

**Purpose**: Synthesise a grounded definition and interpretive lens from all segments under a code.

**Process**:
1. Gather all segment texts for a given code
2. Call `gemini-2.5-flash` (reasoning model) with structured prompt
3. Parse response into definition, lens, and reasoning
4. Upsert `analysis_results` with the same ID if this is an update, else new UUID
5. Push `analysis_updated` WebSocket message

**Prompt** ([backend/prompts/analysis_prompt.py](backend/prompts/analysis_prompt.py)):
- All quotes numbered for reference
- Researcher's own code definition (if provided) to detect drift
- Request: `{definition, lens, reasoning}`

The "lens" describes the interpretive framework — e.g. "power dynamics" or "narrative repair strategies" — that the researcher's coding appears to be revealing.

**Trigger**:
- **Automatic**: When code reaches 3 segments AND has ≥2 new segments since last analysis
- **Manual**: POST `/api/segments/analyze` (requires ≥2 segments)

---

## Model Selection & Tiering

### Why Google Gemini?

| Criterion | OpenRouter (old) | Google Gemini (new) |
|-----------|------------------|-------------------|
| Fast model | Llama 4 Maverick:free (unreliable JSON, rate-limited) | `gemini-2.0-flash` (1500 req/day free, strong JSON mode) |
| Reasoning model | Qwen3-235B:free (token limits, slow) | `gemini-2.5-flash-preview` (500 req/day free, excellent instruction following) |
| Cost | $0/month (free tier is flaky) | $0/month free tier with reasonable limits |
| API | OpenAI-compatible (requires proxy) | OpenAI-compatible endpoint @ `generativelanguage.googleapis.com/v1beta/openai/` |
| Setup complexity | Single, unified proxy | Single direct endpoint |

### Model Tiers

| Purpose | Model | Free Quota | Why |
|---------|-------|-----------|-----|
| **Fast inference** | `gemini-2.0-flash` | 1500 req/day | Ghost partner, first-pass consistency — fast + cheap |
| **Reasoning** | `gemini-2.5-flash-preview-04-17` | 500 req/day | Analysis, escalated consistency — best instruction following |
| **Embeddings** | `all-MiniLM-L6-v2` (local) | Unlimited | 384-dim, fast, sufficient for within-project similarity |

### Escalation Logic

```python
# In check_self_consistency():
1. Call gemini-2.0-flash with consistency prompt
2. Parse response → score_value (0.0–1.0)
3. If score < 0.7:
   # Uncertain; spend the reasoning model's quota
   Call gemini-2.5-flash with same prompt
   Use reasoning model's response
4. Return final result
```

This balances cost (save tokens on 80% of straightforward checks) with quality (catch edge cases with better reasoning).

---

## API Integration

### Endpoint & Authentication

```python
# From config.py
OpenAI(
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    api_key=settings.gemini_api_key,  # from .env
)
```

**Setup**:
1. Create a free Google AI Studio account at [aistudio.google.com](https://aistudio.google.com)
2. Generate an API key (no billing required for free tier)
3. Set `GEMINI_API_KEY=<your-key>` in `.env`

### Client Lifecycle

- **Before**: New `OpenAI` client instantiated on every LLM call
- **Now**: Module-level singleton in `services/ai_analyzer.py` — created once, reused for all requests

This eliminates unnecessary socket/connection overhead.

### Error Handling

The `_call_llm()` function uses OpenAI SDK's built-in retry logic. If a request fails:
- API errors are caught in `_run_background_agents()`
- An `agent_error` WebSocket message is sent
- The agent fails gracefully without crashing the backend

---

## Embedding & Vector Search

### Local Embeddings (Default)

- **Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Dimension**: 384
- **Compute**: CPU-local (no API calls)
- **Latency**: ~10–50ms per embedding
- **Cost**: $0
- **Use case**: Within-project similarity (good enough for 8-10K segment documents)

### Multi-User Collections

ChromaDB maintains one collection per user:
```python
collection_name = f"segments_{user_id}"
```

This ensures deletion of a code cascades only to that user's embeddings (fixes the `CURRENT_USER='default'` bug in earlier versions).

### Query Strategy

`find_similar_across_codes()` retrieves top-K segments by cosine similarity. Metadata filters can narrow by code label. Metadata stored per segment:
- `text_preview` (first 300 chars)
- `code` (code label)
- `document_id`

---

## Windowed Context

To avoid sending 5–15K token documents to every agents prompt, segments.py extracts a **window**:

```python
def _extract_window(full_text: str, start: int, end: int, sentences: int = 2) -> str:
    """
    Extract ~2 sentence boundaries before 'start' and after 'end'.
    Return: "...context... >>> HIGHLIGHT <<< context..."
    """
```

**Impact**:
- Consistency check prompt: ~300 tokens → ~100 tokens (headers + context window)
- Faster inference, lower cost, less noise
- Sufficient for the models to understand the qualitative context

---

## Data Flow

### Segment Creation

1. **Endpoint**: `POST /api/segments/`
2. **Sync path**:
   - Insert into `coded_segments` table
   - Fetch code label/color
   - Return `SegmentOut` (fast, user sees it immediately)
3. **Async path** (if `GEMINI_API_KEY` is set):
   - `add_task(_run_background_agents, ...)`
   - Main request returns; agents run in background

### Background Agents Execution

Inside `_run_background_agents()` (runs in thread pool):

```
1. ws_send(agents_started)
2. Embed segment → ChromaDB
3. If user_segment_count >= MIN_SEGMENTS_FOR_CONSISTENCY:
   │
   ├─ ws_send(agent_thinking: consistency)
   ├─ consistency = check_self_consistency(similar, definitions)
   ├─ INSERT agent_alert(alert_type='consistency', payload=consistency)
   └─ ws_send(consistency)
   
4. ws_send(agent_thinking: ghost_partner)
   ├─ ghost = ghost_partner_predict(partner_history, proposed_code)
   ├─ INSERT agent_alert(alert_type='ghost_partner', payload=ghost)
   └─ ws_send(ghost_partner)
   
5. If code_segment_count >= AUTO_ANALYSIS_THRESHOLD and growth >= threshold:
   │
   ├─ ws_send(agent_thinking: analysis)
   ├─ analysis = analyze_quotes(code_label, all_quotes)
   ├─ UPSERT analysis_results(id=existing_or_new, definition=..., lens=...)
   └─ ws_send(analysis_updated)
   
6. ws_send(agents_done)
```

**Threading safety**: 
- Background task opens its own DB session (`SessionLocal()`)
- WebSocket sends use `send_alert_threadsafe()` which calls `asyncio.run_coroutine_threadsafe(send_alert, loop)` — no blocking on the main event loop

---

## Key Optimizations

### 1. N+1 Query Elimination

**Before**: `list_segments()` looped through each segment and queried the `Code` table:
```python
for s in segments:
    code = db.query(Code).filter(Code.id == s.code_id).first()  # ← N queries
```

**Now**: Single JOIN:
```python
rows = db.query(CodedSegment, Code).outerjoin(Code, CodedSegment.code_id == Code.id).all()
```

Result: 50–100 segments go from ~50 DB queries → 1 query.

### 2. Event Loop Safety

**Before**: Background threads called `asyncio.run(ws_manager.send_alert())`, creating new event loops and causing `RuntimeError`.

**Now**: 
- Main event loop captured in `lifespan()` startup
- Passed to `ws_manager.set_loop(loop)`
- Background threads use `send_alert_threadsafe()` → `asyncio.run_coroutine_threadsafe(coro, loop)`

### 3. Module-Level Client Singleton

**Before**: New `OpenAI` client on every LLM call
**Now**: Single reused client in `services/ai_analyzer.py`

### 4. Dead Code Removed

Removed unused streaming code:
- `_call_llm_stream()` in `ai_analyzer.py`
- `send_stream_token()` / `send_stream_end()` in `ws_manager.py`

If streaming is needed in the future, these can be re-implemented cleanly.

### 5. Graceful .env Backwards Compatibility

Old `.env` files with `OPENROUTER_API_KEY` no longer crash. Config uses `ConfigDict(extra="allow")` to ignore undefined environment variables.

---

## Suggested Improvements

### High Priority

1. **True Ghost Partner Simulation**
   - Currently uses the same researcher's coding history
   - Options:
     - Hold out a random 25% of segments for the ghost to evaluate blind
     - Use a different model (e.g. Gemini 1.5 Pro) so outputs differ systematically
     - Build a separate "coder profile" learned only from code definitions, not examples

2. **Streaming Responses**
   - Remove the dead `_call_llm_stream` placeholder
   - Implement true token streaming from Gemini's streaming API
   - Stream tokens to AlertPanel in real-time for longer analyses

3. **Persistent Embedding Migration**
   - If embedding model changes, ChromaDB vectors become stale
   - Add a CLI tool: `python scripts/re_embed.py --user_id <id> --model all-MiniLM-L6-v2`
   - Re-index all segments for a user

4. **Multi-User Authentication**
   - Currently UI hardcodes `user_id="default"`
   - Add JWT or OAuth2 login
   - True multi-coder projects (unlock the real Ghost Partner and Mediation agents)

### Medium Priority

5. **Real Inter-Rater Reliability Metrics**
   - Track when ghost_partner conflicts with user's actual code
   - Compute kappa or other agreement stats over time
   - Display researcher dashboard showing inter-rater reliability trajectory

6. **Codebook Drift Detection**
   - Compare current analysis definition vs. previous one
   - If divergence > threshold, push a "drift_warning" alert
   - Help researcher notice when their lens is evolving

7. **Debounced Analysis Queue**
   - When segments are coded rapidly, analysis jobs pile up
   - Introduce a small delay (5s) after the last segment before running analysis
   - Use `asyncio.Task` with cancellation to debounce

8. **Prompt Caching**
   - For repeated consistency checks on the same code, much prompt context repeats
   - OpenAI/Gemini support prompt caching headers
   - Configure `extra_headers` to enable it and reduce API calls

### Low Priority

9. **Mediation Agent (Unused)**
   - `prompts/mediation_prompt.py` exists but isn't called
   - Add an endpoint `/api/alerts/{alert_id}/mediate` to resolve conflicts
   - Call the mediation agent for flagged inconsistencies

10. **Model A/B Testing**
    - Route some prompts through two models
    - Compare consistency/analysis quality
    - Automate model selection based on performance

11. **Export to QDAS Formats**
    - NVivo XML, ATLAS.ti, MAXQDA formats
    - Let researchers download coded data for external tools

12. **RAG Over Research Methodology**
    - Fetch academic papers on qualitative research & coding
    - Ground code definitions in published frameworks

---

## File Reference

| File | Purpose | Key Functions |
|------|---------|---|
| `config.py` | Pydantic Settings, .env loader | Settings class, ConfigDict(extra="allow") |
| `main.py` | FastAPI app setup, lifespan, WebSocket | lifespan (event loop capture), websocket_endpoint |
| `database.py` | SQLAlchemy ORM, tables | SessionLocal, init_db, table definitions |
| `models.py` | Pydantic schemas | SegmentOut, AnalysisOut, AlertOut |
| `routers/segments.py` | Segment CRUD, agent orchestration | create_segment, list_segments, _run_background_agents |
| `routers/codes.py` | Code CRUD | create_code, delete_code (with user_id param) |
| `routers/documents.py` | Document CRUD | upload_document, delete_document (with user_id param) |
| `routers/projects.py` | Project CRUD | create_project, delete_project (with user_id param) |
| `services/ai_analyzer.py` | Gemini API calls, tiered inference | _get_client (singleton), check_self_consistency, ghost_partner_predict, analyze_quotes |
| `services/vector_store.py` | ChromaDB management | add_segment_embedding, find_similar_across_codes, _embed_local, _embed_api |
| `services/ws_manager.py` | WebSocket broadcast | ConnectionManager, send_alert_threadsafe, set_loop |
| `prompts/self_consistency_prompt.py` | Self-consistency prompt builder | build_self_consistency_prompt |
| `prompts/ghost_partner_prompt.py` | Ghost partner prompt builder | build_ghost_partner_prompt |
| `prompts/analysis_prompt.py` | Analysis prompt builder | build_analysis_prompt |
| `utils/file_parser.py` | File extraction (TXT/PDF/DOCX) | extract_text, extract_html, _extract_pdf_text (uses pypdf) |

---

## Environment Setup

### Required

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### .env File

```
GEMINI_API_KEY=<your-key-from-aistudio.google.com>
```

Optional:
```
FAST_MODEL=gemini-2.0-flash
REASONING_MODEL=gemini-2.5-flash-preview-04-17
EMBEDDING_MODEL=local
MIN_SEGMENTS_FOR_CONSISTENCY=3
AUTO_ANALYSIS_THRESHOLD=3
CONSISTENCY_ESCALATION_THRESHOLD=0.7
DATABASE_URL=sqlite:///./inductive_lens.db
CHROMA_PERSIST_DIR=./chroma_data
```

### Run Backend

```bash
cd backend
export GEMINI_API_KEY="<key>"
uvicorn main:app --reload
```

Backend runs on `http://localhost:8000`; docs at `http://localhost:8000/docs`.

---

## Technology Stack

| Component | Library | Version |
|-----------|---------|---------|
| Web framework | FastAPI | ≥0.109.0 |
| ASGI server | Uvicorn | ≥0.27.0 |
| ORM | SQLAlchemy | ≥2.0.0 |
| Vector DB | ChromaDB | ≥0.4.22 |
| LLM SDK | OpenAI (Gemini endpoint) | ≥1.30.0 |
| Embeddings | sentence-transformers | ≥2.2.0 |
| PDF extraction | pypdf | ≥4.0.0 |
| DOCX extraction | python-docx | ≥1.1.0 |
| Config | pydantic-settings | ≥2.0.0 |
