# Backend Architecture — The Inductive Lens

This document describes the backend's agentic AI architecture, the model selection rationale, and suggested improvements.

---

## Table of Contents

- [System Overview](#system-overview)
- [Agentic Architecture](#agentic-architecture)
  - [Agent 1: Self-Consistency Checker](#agent-1-self-consistency-checker)
  - [Agent 2: Ghost Partner](#agent-2-ghost-partner)
  - [Agent 3: Inductive Analysis](#agent-3-inductive-analysis)
  - [Agent 4: Mediation (Unused)](#agent-4-mediation-unused)
- [Tiered Inference](#tiered-inference)
- [Embedding Strategy](#embedding-strategy)
- [Windowed Context](#windowed-context)
- [Model Options](#model-options)
  - [Free Models](#free-models)
  - [Cheap Models ($0.01-0.30/M tokens)](#cheap-models)
  - [Premium Models](#premium-models)
- [OpenRouter Integration](#openrouter-integration)
- [Suggested Improvements](#suggested-improvements)

---

## System Overview

```
User codes a segment
        │
        ▼
┌─ POST /api/segments/ ──────────────────────────────┐
│  1. Save segment to SQLite                         │
│  2. Schedule 3 BackgroundTasks:                     │
│     ├─ embed + self-consistency check              │
│     ├─ ghost partner prediction                    │
│     └─ auto-analysis (if threshold met)            │
│  3. Return segment immediately (non-blocking)      │
└────────────────────────────────────────────────────┘
        │
        ▼  (background, async)
┌────────────────────────────────────────────────────┐
│  Each agent:                                       │
│  1. Gathers context (vector search, DB queries)    │
│  2. Builds a structured prompt                     │
│  3. Calls OpenRouter LLM (fast or reasoning tier)  │
│  4. Parses JSON response                           │
│  5. Persists alert to DB                           │
│  6. Pushes alert via WebSocket                     │
└────────────────────────────────────────────────────┘
```

The backend uses **FastAPI BackgroundTasks** rather than a task queue (Celery, etc.) for simplicity. Each agent runs sequentially within its background task but all three tasks run concurrently.

---

## Agentic Architecture

### Agent 1: Self-Consistency Checker

**Purpose**: Detect when a new coding deviates from the user's established patterns.

**Flow**:
1. Embed the new segment text into ChromaDB
2. Retrieve top-K (default 8) most similar prior segments via cosine similarity
3. Load existing analysis definitions for context
4. Build a prompt with the segment, similar segments, and definitions
5. Call the **fast model** to assess consistency
6. If `consistency_score` < threshold (0.7), **escalate** to the reasoning model
7. Push a `consistency` alert with the score, reasoning, and any suggestions

**Prompt** ([prompts/self_consistency_prompt.py](backend/prompts/self_consistency_prompt.py)):
- Includes prior coding history grouped by code label
- Asks for a JSON response: `{consistency_score, is_consistent, reasoning, suggestion, drift_warning}`

**When it triggers**: Only when the user has ≥3 existing segments (configurable via `MIN_SEGMENTS_FOR_CONSISTENCY`).

---

### Agent 2: Ghost Partner

**Purpose**: Simulate a second coder who independently assesses the highlighted text.

**Flow**:
1. Receive windowed document context (~2 sentences before/after the highlight)
2. Receive the user's coding history (from vector search)
3. Build a prompt asking the "ghost" to predict the correct code
4. Call the **fast model**
5. Compare the ghost's prediction with the user's actual code
6. Push a `ghost_partner` alert (agree or conflict)

**Prompt** ([prompts/ghost_partner_prompt.py](backend/prompts/ghost_partner_prompt.py)):
- Document context uses `>>>` markers around the highlighted span
- Includes all available codes with their existing segment counts
- Asks for JSON: `{predicted_code, confidence, reasoning, is_conflict, conflict_explanation}`

**Known limitation**: The ghost receives the same user's coding history, making true independence impossible. See [improvements](#suggested-improvements).

---

### Agent 3: Inductive Analysis

**Purpose**: Synthesise a grounded definition and interpretive lens from all segments under a code.

**Flow**:
1. Gather all segment texts for the given code
2. Call the **reasoning model** with the full list of quotes
3. Parse the response into definition, lens, and reasoning
4. Upsert the analysis result in the DB
5. Push an `analysis_updated` alert

**Prompt** ([prompts/analysis_prompt.py](backend/prompts/analysis_prompt.py)):
- Presents all quotes numbered for reference
- Asks for JSON: `{definition, lens, reasoning}`
- The "lens" describes the interpretive framework the coder appears to be using

**When it triggers**: Automatically when a code reaches `AUTO_ANALYSIS_THRESHOLD` (3) segments and has at least 2 new segments since the last analysis. Also triggerable manually via the UI.

---

### Agent 4: Mediation (Unused)

**Purpose**: Resolve conflicts between two coders who coded the same text differently.

**Prompt** ([prompts/mediation_prompt.py](backend/prompts/mediation_prompt.py)):
- Takes two users' codings of the same text plus their coding histories
- Asks for a nuanced resolution
- Currently wired in `ai_analyzer.py` but not called from any endpoint

---

## Tiered Inference

The system uses two model tiers accessed through OpenRouter:

| Tier | Config Key | Default Model | Use Cases |
|------|-----------|---------------|-----------|
| **Fast** | `FAST_MODEL` | `meta-llama/llama-4-maverick:free` | Self-consistency (first pass), ghost partner |
| **Reasoning** | `REASONING_MODEL` | `qwen/qwen3-235b-a22b:free` | Analysis, mediation, escalated consistency |

**Escalation logic** (in `check_self_consistency`):
```
1. Run fast model → get consistency_score
2. If score < CONSISTENCY_ESCALATION_THRESHOLD (0.7):
   a. Re-run with reasoning model
   b. Use reasoning model's result instead
3. Push whichever result to user
```

This saves tokens on the ~80% of checks that are straightforward while ensuring edge cases get deeper analysis.

---

## Embedding Strategy

Two modes, controlled by `EMBEDDING_MODEL` in `.env`:

### Local (default: `local`)
- **Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Dimension**: 384
- **Cost**: Free (runs on CPU)
- **Latency**: ~10-50ms per embedding
- **Trade-off**: Lower quality than API embeddings but sufficient for within-project similarity

### API (any OpenRouter embedding model)
- Set `EMBEDDING_MODEL` to an OpenRouter model name (e.g. `openai/text-embedding-3-small`)
- Higher quality, but adds API cost and latency

The embedding is stored in ChromaDB per-user collections with cosine distance. Metadata includes code label, document ID, and text preview.

---

## Windowed Context

Instead of sending the full document to every prompt, `segments.py` extracts a **window** around the highlighted text:

```python
def _extract_window(full_text, start, end, sentences=2):
    # Find ~2 sentence boundaries before 'start'
    # Find ~2 sentence boundaries after 'end'
    # Return: "...prior context... >>> HIGHLIGHTED TEXT <<< ...following context..."
```

**Why**: A typical qualitative document is 5-15K tokens. Sending it all for every consistency check wastes 80%+ of context on irrelevant text. The window provides enough context for the LLM to understand the passage while keeping prompt size under 1K tokens.

---

## Model Options

All models are accessed via [OpenRouter](https://openrouter.ai/). Switch models by changing `FAST_MODEL` and `REASONING_MODEL` in `.env`.

### Free Models

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| `deepseek/deepseek-chat-v3-0324:free` | ★★★★ | ★★★★ | Fast inference, consistency checks |
| `deepseek/deepseek-r1:free` | ★★ | ★★★★★ | Reasoning, analysis, escalation |
| `google/gemma-3-27b-it:free` | ★★★ | ★★★ | Alternative fast model |
| `qwen/qwen3-30b-a3b:free` | ★★★★ | ★★★ | Mixture-of-experts, fast |
| `meta-llama/llama-4-maverick:free` | ★★★ | ★★★★ | Alternative reasoning |
| `microsoft/phi-4-reasoning-plus:free` | ★★ | ★★★★ | Small but strong reasoning |

**Current defaults**: Llama 4 Maverick (fast) + Qwen3-235B (reasoning) — both free, good quality for the price point (zero).

### Cheap Models

| Model | Input $/M | Output $/M | Notes |
|-------|-----------|------------|-------|
| `google/gemini-2.5-flash` | $0.15 | $0.60 | Best price-performance ratio |
| `anthropic/claude-3.5-haiku` | $0.80 | $4.00 | Fast, high quality |
| `openai/gpt-4o-mini` | $0.15 | $0.60 | Reliable, well-tested |
| `deepseek/deepseek-chat-v3-0324` | $0.14 | $0.28 | Non-free version, higher rate limits |

### Premium Models

| Model | Input $/M | Output $/M | Notes |
|-------|-----------|------------|-------|
| `anthropic/claude-sonnet-4` | $3.00 | $15.00 | Excellent reasoning |
| `openai/o3` | $2.00 | $8.00 | Strong chain-of-thought |
| `google/gemini-2.5-pro` | $1.25 | $10.00 | Long context window |

### Recommended Combinations

| Budget | Fast Model | Reasoning Model |
|--------|-----------|----------------|
| **Free** | `meta-llama/llama-4-maverick:free` | `qwen/qwen3-235b-a22b:free` |
| **$1-5/month** | `google/gemini-2.5-flash` | `qwen/qwen3-235b-a22b:free` |
| **Best quality** | `google/gemini-2.5-flash` | `anthropic/claude-sonnet-4` |

---

## OpenRouter Integration

The backend uses the **OpenAI Python SDK** pointed at OpenRouter's endpoint:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.openrouter_api_key,
)

response = client.chat.completions.create(
    model=settings.fast_model,
    messages=[{"role": "user", "content": prompt}],
    response_format={"type": "json_object"},
)
```

**Why OpenRouter over direct APIs**:
- Single API key for 600+ models
- Switch models by changing one env var
- Automatic fallback and load balancing
- Free tier models available
- OpenAI-compatible SDK — no custom code needed

---

## Suggested Improvements

### High Priority

1. **True Ghost Partner Independence**
   Currently the ghost partner receives the same user's coding history. For genuine inter-rater simulation:
   - Option A: Train on a subset of segments, withhold the rest
   - Option B: Use a different model/temperature for the ghost than the consistency checker
   - Option C: Build a separate "coder profile" for the ghost based only on the code definitions

2. **Wire Up Mediation Agent**
   The mediation prompt and `mediate_conflict()` function exist but aren't called from any endpoint. Add a UI action for when consistency/ghost alerts flag conflicts.

3. **Streaming Responses**
   The `_call_llm_stream()` function exists in `ai_analyzer.py` and `ws_manager.py` has `send_stream_token()`. Wire these together so ghost partner reasoning streams to the AlertPanel in real-time.

4. **Persistent Embedding Cache**
   If the embedding model changes (e.g. switching from local to API), existing ChromaDB vectors become inconsistent. Add a migration script that re-embeds all segments.

### Medium Priority

5. **Batch Analysis Queue**
   When many segments are coded rapidly, background tasks can pile up. Consider:
   - Debouncing analysis triggers (e.g. wait 5s after last segment before running)
   - Using a lightweight queue (e.g. `asyncio.Queue` with a worker)

6. **Prompt Caching**
   For repeated analysis runs on the same code, much of the prompt context is identical. OpenRouter supports prompt caching on some models — configure `extra_headers` to enable it.

7. **Multi-User Support**
   The architecture has `user_id` fields everywhere but the UI hardcodes `"default"`. Adding a login screen and per-user WebSocket routing would unlock:
   - True multi-coder projects
   - Real (not simulated) inter-rater reliability
   - The mediation agent

8. **Codebook Drift Detection**
   Track how code definitions evolve over time. When `analyze_quotes()` produces a definition that significantly differs from the previous one, push a "drift" alert comparing old vs new.

### Low Priority

9. **Model A/B Testing**
   Run the same prompt through two models and compare responses. Useful for evaluating whether a model upgrade improves analysis quality.

10. **Confidence Calibration**
    Track whether high-confidence consistency checks are actually correct over time. Use this to tune the escalation threshold.

11. **Export to QDAS Formats**
    Export coded data to formats compatible with NVivo, ATLAS.ti, or MAXQDA for researchers who want to continue in traditional tools.

12. **RAG Over Research Literature**
    Add a second vector store for academic papers. When generating code definitions, retrieve relevant methodology literature to ground the analysis in established frameworks.

---

## File Reference

| File | Purpose |
|------|---------|
| `config.py` | Pydantic Settings (`.env` loader) |
| `main.py` | FastAPI app, CORS, WebSocket endpoint |
| `database.py` | SQLAlchemy engine + session |
| `models.py` | Pydantic request/response schemas |
| `routers/segments.py` | Agent orchestration, windowed context |
| `services/ai_analyzer.py` | OpenRouter LLM calls, tiered inference |
| `services/vector_store.py` | ChromaDB + dual-mode embeddings |
| `services/ws_manager.py` | WebSocket connection + streaming |
| `prompts/*.py` | Structured prompt templates |
| `utils/file_parser.py` | PDF/DOCX/TXT extraction |
