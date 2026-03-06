# Co-Refine — Comprehensive Application Document

## 1. Executive Summary

**Co-Refine** is an AI-augmented qualitative coding research tool developed as a dissertation project at the University of Nottingham. It enables a solo qualitative researcher to upload textual documents, highlight text segments, assign qualitative codes, and receive real-time AI-powered self-consistency audits of their coding decisions. The system addresses a fundamental gap in qualitative research software: the absence of tools that support **intra-coder consistency** — the consistency of a single researcher with themselves over time — as opposed to traditional inter-coder reliability (ICR), which requires multiple coders and is philosophically mismatched with reflexive and interpretive research paradigms.

The system implements a **2-stage audit pipeline** combining deterministic embedding-based metrics with large language model (LLM) judgment. Supporting features include AI-inferred operational definitions, sub-theme (facet) discovery via clustering, a conversational AI research assistant, visualisation dashboards, and a full edit audit trail. The architecture follows a client-server model with a React 19 single-page application frontend and a FastAPI backend, using SQLite for relational storage, ChromaDB for vector embeddings, and Azure OpenAI for LLM inference.

---

## 2. Theoretical Foundation and Motivation

### 2.1 The Problem with Inter-Coder Reliability

Traditional qualitative data analysis software (CAQDAS) tools such as NVivo, ATLAS.ti, and MAXQDA rely on inter-coder reliability (ICR) as the primary mechanism for ensuring coding quality. ICR measures agreement between two or more coders applying the same codebook to the same data. However, this approach has significant limitations:

1. **Solo researcher inapplicability**: The majority of qualitative research, particularly at the dissertation level, is conducted by a single researcher. ICR is structurally impossible without a second coder (Halpin, 2024).

2. **Philosophical mismatch**: Reflexive thematic analysis (Braun & Clarke, 2006, 2019, 2021) treats codes as interpretive acts, not objective labels. ICR assumes a "correct" coding exists and that disagreement represents error, whereas reflexive approaches view divergence as productive analytical tension (O'Connor & Joffe, 2020).

3. **Interpretive voice suppression**: Introducing additional coders to achieve ICR can obscure the primary researcher's interpretive voice, undermining the very reflexivity that gives qualitative research its analytical depth (Small, 2011; Quirks, 2020; IAPHS).

4. **Intra-coder consistency as the relevant measure**: For solo researchers, the meaningful question is not "do two people agree?" but "am I applying my own codes consistently over time?" (Halpin, 2024; Delve Tool, 2025). Intra-coder testing builds trust in the researcher's own analytical process.

### 2.2 Co-Refine's Alternative: AI-Powered Self-Consistency

Co-Refine replaces the ICR paradigm entirely. Instead of simulating a second coder, it provides a **self-consistency audit pipeline** that:

- Computes deterministic mathematical metrics from text embeddings to measure coding consistency
- Uses an LLM as a "ghost partner" that audits the researcher's own coding decisions against their own prior patterns
- Grounds all LLM judgments on empirical embedding evidence, preventing hallucination
- Tracks consistency longitudinally, enabling the researcher to monitor and reflect on drift in their coding over time

This approach is grounded in Wang et al.'s (2022) self-consistency principle for LLMs, the Thematic-LM approach for embedding-based thematic coherence, and the LOGOS framework for longitudinal concept drift detection.

---

## 3. Technology Stack

### 3.1 Backend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Web framework | FastAPI (Python 3.12+) | Async-native, WebSocket support, automatic OpenAPI docs, dependency injection |
| ORM | SQLAlchemy 2.x (declarative base) | Mature, type-safe ORM with relationship cascade support |
| Database | SQLite (file-based) | Zero-configuration, sufficient for single-researcher use case |
| Vector store | ChromaDB (persistent, cosine distance) | Lightweight persistent embedding store |
| Embeddings | Local `all-MiniLM-L6-v2` via SentenceTransformer (default) or Azure OpenAI API | Local embeddings: zero API cost, runs on CPU; API embeddings: higher quality at cost |
| LLM inference | Azure OpenAI — reasoning model (`gpt-5.2`) | Single deep-analysis model used for all audit judgments, auto-analysis, and facet labelling |
| Chat streaming | Azure OpenAI — fast model (`gpt-5-mini`) | Lower-latency streaming for the conversational assistant |
| Validation | Pydantic v2 (BaseModel for DTOs, BaseSettings for configuration) | Type-safe request/response schemas with automatic validation |

### 3.2 Frontend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | React 19 (functional components + hooks only) | Industry standard, large ecosystem, hooks-based architecture |
| Language | TypeScript ~5.7 (strict mode) | Type safety with no `any` — uses `unknown` with type guards when needed |
| Styling | Tailwind CSS 3 with custom design tokens | Utility-first CSS with project-specific tokens (`surface-*`, `brand-*`, `panel-*`) |
| State management | Zustand v5 (slice-based, composed store) | Lightweight, no boilerplate, supports cross-slice composition via `get()` |
| UI primitives | Radix UI (`@radix-ui/react-*`) | Accessible, unstyled primitives for dialogs, tooltips, popovers |
| Charts | Recharts | Composable React-based charting for trend lines, scatter plots, box plots |
| Icons | Lucide React | Consistent, accessible icon library |
| Build tool | Vite 6 | Fast HMR, optimised production builds |
| Testing | Vitest + React Testing Library + Playwright (e2e) + axe-core (a11y) | Behaviour-focused unit tests, accessibility audits, end-to-end flows |

---

## 4. Data Model

The application uses 12 SQLAlchemy ORM models with UUID string primary keys throughout. All parent-child relationships use `cascade="all, delete-orphan"` for referential integrity.

### 4.1 Core Entities

**Project** — Top-level container for a qualitative research project. Stores per-project AI configuration including `enabled_perspectives` (JSON array of which audit lenses are active) and `thresholds_json` (JSON object of threshold overrides for scoring parameters such as `drift_warning_threshold` and `code_overlap_warning_threshold`). All child entities (documents, codes, alerts, etc.) are cascade-deleted when a project is removed.

**Document** — An uploaded textual document within a project. Supports three formats: plain text (`.txt`), Word documents (`.docx` with HTML preservation via Mammoth), and PDF (`.pdf` via PyPDF). Stores both `full_text` (plain text extraction for analysis) and `html_content` (formatted HTML for DOCX files, used in the document viewer). The `doc_type` field records the source format.

**Code** — A qualitative code (label) within a project's codebook. Stores the researcher-defined `label`, `definition` (optional natural-language explanation of the code's meaning), `colour` (hex colour for UI highlighting), and `created_by` (user identifier). Duplicate labels within a project are rejected with a 409 Conflict response.

**CodedSegment** — A text span within a document that has been assigned a code. Stores `start_index` and `end_index` (character offsets into the document text), `text` (the highlighted text), and foreign keys to both `Document` and `Code`. Stores `tsne_x` and `tsne_y` coordinates populated during facet analysis for scatter plot visualisation.

### 4.2 AI Analysis Entities

**AnalysisResult** — An AI-inferred operational definition and interpretive lens for a code, synthesised from all segments coded with that code. Stores `definition` (the AI's inferred operational definition), `lens` (the AI's interpretation of the researcher's analytical perspective), `reasoning` (the AI's chain of thought), and `segment_count_at_analysis` (the segment count when analysis was last run). One record per code, replaced on re-analysis.

**AgentAlert** — A persisted AI audit notification for a specific segment. The `alert_type` is `"coding_audit"`. The `payload` field stores the complete JSON audit result including consistency scores, severity, reasoning, alternative code suggestions, and all metadata. The `is_read` flag supports an unread-only filter in the frontend.

**ConsistencyScore** — An **append-only time-series table** that captures the complete audit state for each segment evaluation. This is the primary data source for longitudinal consistency analysis. Each record contains:
- **Stage 1 deterministic metrics**: `centroid_similarity`, `is_pseudo_centroid`, `temporal_drift`
- **Stage 2 LLM scores**: `llm_consistency_score`, `llm_intent_score`, `llm_overall_severity`
- **Project/user provenance**: `project_id`, `user_id`, `created_at`

### 4.3 Supplementary Entities

**ChatMessage** — Stores messages in the conversational AI assistant. Each message has a `conversation_id` (grouping messages into conversations), `role` (`"user"` or `"assistant"`), and `content`. Supports multiple named conversations per project.

**EditEvent** — A complete audit trail of every mutation in the system. Records `entity_type` (`"segment"` or `"code"`), `action` (`"created"`, `"updated"`, `"deleted"`), `entity_id`, `field_changed`, `old_value`, and `new_value`. Every code creation, update, deletion, and every segment creation and deletion generates an edit event.

**Facet** — A sub-theme cluster within a code, discovered via KMeans clustering of segment embeddings. Stores `label` (active display name), `suggested_label` (AI-generated name, preserved even after researcher renames), `label_source` (`"auto"`, `"ai"`, or `"user"`), `centroid_json` (cluster centroid embedding), `segment_count`, `is_active` (old facets are deactivated when re-clustering runs), and `project_id`.

**FacetAssignment** — Links segments to facets with a `similarity_score` (cosine similarity to facet centroid).

---

## 5. The 2-Stage Self-Consistency Audit Pipeline

This is the core novel contribution of Co-Refine. The pipeline executes as a FastAPI `BackgroundTask` whenever a researcher creates a new coded segment, ensuring the UI returns immediately while the audit runs asynchronously. Results are pushed to the frontend via WebSocket events.

### 5.1 Stage 1: Deterministic Scoring (Pure Mathematics, No LLM)

Stage 1 computes three embedding-based metrics that provide objective, reproducible measures of coding consistency. These metrics serve as factual grounding for the LLM judgment in Stage 2, preventing the LLM from ignoring empirical evidence.

The `compute_stage1_scores()` function in `features/scoring/pipeline.py` aggregates all Stage 1 metrics and returns a dict with: `centroid_similarity`, `is_pseudo_centroid`, `temporal_drift`, `segment_count`.

#### 5.1.1 Centroid Similarity (Thematic-LM Approach)

**Concept**: Each code accumulates an embedding centroid — the L2-normalised mean of all segment embeddings assigned to that code. A new segment's consistency with the code is measured by its cosine similarity to this centroid.

**Algorithm** (in `features/scoring/centroid.py`):
1. Retrieve all current embeddings for the code from ChromaDB.
2. If at least 1 embedding exists, compute the L2-normalised mean vector (the code centroid). This is the **real centroid** — `is_pseudo = False`.
3. Compute cosine similarity between the new segment's embedding and the centroid.
4. Result: a value in [0, 1] where 1.0 means the new segment is semantically identical to the average of all prior segments coded with this code.

**Cold-start fallback**: When **no** segments exist yet for the code (the very first segment), the centroid cannot be computed. If the researcher has supplied a code definition, that definition text is embedded and used as a "pseudo-centroid" — `is_pseudo = True`. This is flagged so downstream stages can apply appropriate caution. If no definition exists either, this metric returns `None`.

**Academic grounding**: Inspired by the Thematic-LM approach to measuring thematic coherence via embedding space proximity.

#### 5.1.2 Temporal Drift (LOGOS-Inspired)

**Concept**: Measures whether a code's meaning is shifting over time by comparing the centroid of the oldest segments to the centroid of the most recent segments.

**Algorithm** (in `features/scoring/temporal_drift.py`):
1. Retrieve all segments for the code from ChromaDB with their `created_at` metadata.
2. Sort by `created_at` timestamp.
3. Require a minimum of 10 total segments (`window_old=5` + `window_recent=5`). Returns `None` if insufficient.
4. Compute the centroid of the **oldest 5** segments.
5. Compute the centroid of the **newest 5** segments.
6. Drift = `1 - cosine_similarity(old_centroid, recent_centroid)`.
7. Result: a value in [0, 1] where 0.0 means no drift and 1.0 means complete semantic shift.

**Interpretation**: A high temporal drift value suggests the researcher's application of the code has evolved — they may be including different types of text than initially. This can indicate productive conceptual development or problematic definitional erosion. A WebSocket `temporal_drift_warning` event is emitted when drift exceeds the configurable `drift_warning_threshold` (default: 0.3).

**Academic grounding**: Inspired by the LOGOS framework for longitudinal concept drift detection in coding schemes.

#### 5.1.3 Code Overlap Matrix (GATOS-Inspired)

**Concept**: Computes pairwise cosine similarity between all code centroids in the project to identify potential code redundancy — pairs of codes whose segments are semantically near-identical.

**Algorithm** (in `features/scoring/code_overlap.py`):
1. For each code with segments, compute its centroid from ChromaDB.
2. Compute pairwise cosine similarity between all code centroids.
3. Output: a symmetric matrix `{code_label: {code_label: similarity_float}}`.

**Interpretation**: Pairs with similarity above `code_overlap_warning_threshold` (default: 0.85) suggest potential code redundancy — they may be capturing the same underlying theme. This matrix is computed as part of the batch audit and sent to the frontend for visualisation.

**Academic grounding**: Inspired by the GATOS framework for code overlap detection.

### 5.2 Stage 2: LLM Self-Consistency Judgment (Reasoning Model)

Stage 2 makes a single LLM call using the **reasoning model** (`azure_deployment_reasoning`, configured as `gpt-5.2`) for every segment audit. The `run_coding_audit()` function in `services/ai_analyzer.py` orchestrates this stage.

#### 5.2.1 Audit Prompt Construction

The prompt is built by `build_coding_audit_prompt()` (in `prompts/audit_prompt.py`) and structured as a two-message conversation (system + user):

**System prompt** defines the auditor role and strict scoring rules:
- `consistency_score` (0.0–1.0): Must be grounded on centroid similarity. If `centroid_similarity >= 0.75` → score must be ≥ 0.65; if ≤ 0.40 → score must be ≤ 0.45. Deviations > ±0.15 require explicit justification.
- `intent_alignment_score` (0.0–1.0): Semantic match to code intent. Can diverge from `consistency_score`.
- `overall_severity_score` (0.0–1.0): Computed as `1 - consistency_score` with ±0.05 adjustment allowed.
- `overall_severity` string: Must match score thresholds — ≥ 0.65 → `"high"`, 0.35–0.64 → `"medium"`, < 0.35 → `"low"`.

**User prompt** supplies:
1. **Windowed document context**: The surrounding text from the document with the highlighted segment marked by `>>>` and `<<<` delimiters.
2. **Stage 1 deterministic evidence**: All metrics from Stage 1 presented as mathematical facts — centroid similarity, temporal drift, whether a pseudo-centroid was used, and segment count.
3. **Researcher's codebook** (canonical): Researcher-supplied code labels and definitions, treated as authoritative.
4. **AI-inferred definitions** (supplementary): If auto-analysis has run, the AI's inferred operational definition and lens are included as supplementary context.
5. **Coding history**: Prior segments coded with the same code, retrieved from ChromaDB via `get_all_segments_for_code()`.
6. **Co-applied codes hard constraint**: Any codes already applied to the same text span are listed and the LLM is explicitly forbidden from suggesting them as alternatives.

**JSON output structure**:
```json
{
    "self_lens": {
        "is_consistent": true,
        "consistency_score": 0.78,
        "intent_alignment_score": 0.81,
        "reasoning": "Why this is or isn't consistent...",
        "definition_match": "How well this matches the code definition",
        "drift_warning": "Detected shift in code meaning, or empty string",
        "alternative_codes": ["Better-fitting codes not already applied"],
        "suggestion": "Brief constructive suggestion"
    },
    "overall_severity_score": 0.22,
    "overall_severity": "low",
    "score_grounding_note": "How embedding evidence was used"
}
```

After the LLM call returns, the `_escalation` field is appended as `{"was_escalated": False, "reason": None}` for backward compatibility with database fields and frontend consumers.

### 5.3 Pipeline Orchestration

The complete pipeline is managed by `run_background_agents()` in `features/audit/orchestrator.py`:

1. **Embed segment**: Store the new segment's embedding in ChromaDB via `add_segment_embedding()`.
2. **Identify overlapping segments**: Query for any existing segments in the same document whose character ranges overlap with the new segment. These define the `existing_codes_on_span` hard constraint.
3. **Stage 1 scoring**: Call `compute_stage1_scores()` and emit a `deterministic_scores` WebSocket event.
4. **Stage 2 coding audit**: Call `run_coding_audit()` with all context. Filter alternative code suggestions against co-applied codes.
5. **Persist**: Write `AgentAlert` and `ConsistencyScore` rows to the database.
6. **Drift warning**: If `stage1["temporal_drift"]` exceeds `drift_warning_threshold`, emit a `temporal_drift_warning` WebSocket event.
7. **Emit audit result**: Send a `coding_audit` WebSocket event with the full result.
8. **Auto-analysis**: Call `maybe_run_auto_analysis()` which triggers analysis if the code's segment count meets the threshold.
9. **Emit done**: Send `agents_done`.

Each stage is wrapped in independent `try/except` with structured logging. If any stage fails, subsequent stages continue where possible.

### 5.4 Sibling Re-Audit

When a segment is created or deleted, all overlapping segments (segments with overlapping character ranges in the same document) are re-audited via `sibling_auditor.py`. This is necessary because:
- Co-applied code constraints change when codes are added or removed from a span
- Alternative code suggestions on stale alerts would reference incorrect constraints

The re-audit sends `replaces_segment_id` and `replaces_code_id` fields in WebSocket messages so the frontend can replace stale alert cards rather than duplicating them.

### 5.5 Batch Audit

`run_batch_audit_background()` in `features/audit/batch_auditor.py` audits every code in a project at once. For each code:
1. All segments are retrieved via `get_all_segments_for_code()`.
2. The most recently added segment is used as the representative; the rest form the coding history.
3. Stage 1 scores are computed.
4. The audit LLM call runs with the same reasoning model.
5. Results are persisted and progress emitted via `batch_audit_progress` WebSocket events.

After all codes are processed, the code overlap matrix is computed and sent via `code_overlap_matrix` WebSocket event. Temporal drift warnings are emitted per-code.

---

## 6. Auto-Analysis: AI-Inferred Operational Definitions

When a code accumulates segments meeting the configurable threshold (default: `auto_analysis_threshold = 3`), the **reasoning model** automatically synthesises:

1. **Operational definition**: An inferred definition of what the code means based on the actual coded text segments
2. **Interpretive lens**: What analytical perspective or framework the researcher appears to be applying
3. **Reasoning**: The AI's chain of thought explaining its conclusions

Auto-analysis re-triggers every time the segment count grows by the threshold multiple from the last analysis (e.g., at 3, 6, 9 segments). This is checked in `maybe_run_auto_analysis()` in `features/audit/auto_analyzer.py`.

Manual analysis can also be triggered via the `/api/segments/analyze` endpoint, which requires a minimum of 2 segments. Both manual and auto-analysis use the **reasoning model** via `analyze_quotes()` in `services/ai_analyzer.py`.

The AI-inferred definition is treated as **supplementary** to the researcher's own definition throughout. In audit prompts, the researcher's definition is labelled "canonical" while the AI's is labelled "supplementary," preserving the researcher's interpretive authority.

Results are stored in `AnalysisResult` and broadcast via the `analysis_updated` WebSocket event.

---

## 7. Facet Discovery: Sub-Theme Clustering

Co-Refine discovers latent sub-meanings within codes through embedding-based clustering (`features/facets/service.py`).

### 7.1 Clustering Algorithm

1. **Prerequisite**: Minimum `MIN_SEGMENTS_FOR_CLUSTERING = 4` segments for the code.
2. **Embedding retrieval**: All segment embeddings for the code are fetched from ChromaDB.
3. **Optimal K selection via silhouette scores**:
   - K evaluated over range [`MIN_FACETS=2`, `MAX_FACETS=4`]
   - `sklearn.metrics.silhouette_score` computed for each K
   - Highest silhouette score selects K
4. **KMeans clustering**: `sklearn.cluster.KMeans` run with the chosen K.
5. **Dimensionality reduction for 2D visualisation**:
   - t-SNE (perplexity = min(30, max(2, n-1))) as the primary reducer
   - PCA as fallback when t-SNE fails
   - 2D coordinates stored in `CodedSegment.tsne_x` and `tsne_y`
6. **Persistence**: Cluster centroids, labels, and per-segment assignments written to `Facet` and `FacetAssignment` tables. Old facets are deactivated (`is_active = False`) on re-cluster.

### 7.2 AI-Powered Facet Labelling

After clustering, the LLM generates descriptive labels for each facet via `suggest_facet_labels()`:
1. Up to 5 representative segments per facet (highest centroid similarity) are selected.
2. Sent to the fast model (via `build_facet_label_prompt()`) along with the parent code label and definition.
3. The model returns 2–5 word descriptive labels with reasoning.
4. Labels stored as `suggested_label` with `label_source = "ai"`.
5. If the researcher renames a facet via the UI, `suggested_label` is preserved and `label_source` changes to `"user"`.

The `/api/projects/{id}/vis/facets/{facet_id}/explain` endpoint generates an on-demand narrative explanation of a specific facet's sub-theme, using the LLM to synthesise what connects all segments in that cluster.

**Academic grounding**: Facet discovery is grounded in Braun & Clarke's (2006, 2021) concept of sub-themes and Ryan & Bernard's (2003) cutting-and-sorting technique for identifying thematic structure.

---

## 8. Conversational AI Research Assistant

Co-Refine includes a context-aware chat assistant (`features/chat/`) that enables the researcher to interactively explore their coding patterns.

### 8.1 Context Building

When the researcher sends a message, the service builds rich context including:
1. **Codebook context**: All codes with researcher-defined and AI-inferred definitions, interpretive lenses, and segment counts
2. **Semantic search**: The top `vector_search_top_k = 8` coded segments most semantically similar to the message, retrieved from ChromaDB
3. **Conversation history**: The last 20 messages from the current conversation

### 8.2 Streaming Architecture

The response is generated token-by-token and streamed to the frontend via WebSocket:
- `chat_stream_start` → `chat_token` (repeated) → `chat_done`
- The frontend implements optimistic UI: the user's message appears immediately while an assistant placeholder accumulates streaming tokens
- The full response is persisted as a `ChatMessage` upon completion

### 8.3 Chat Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/chat/` | Send message and begin streaming response |
| GET | `/api/chat/history/{conversation_id}` | Fetch conversation history |
| GET | `/api/chat/conversations` | List all conversations for a project |
| DELETE | `/api/chat/conversations/{conversation_id}` | Delete conversation + all messages |

---

## 9. API Reference

### Projects `/api/projects`
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/` | Create project |
| GET | `/` | List all projects (with doc/code counts) |
| GET | `/{project_id}` | Get single project |
| DELETE | `/{project_id}` | Delete project (cascade all children) |
| GET | `/threshold-definitions` | Get metadata for threshold configuration |
| GET | `/{project_id}/settings` | Get project audit settings |
| PUT | `/{project_id}/settings` | Update enabled perspectives + threshold overrides |

### Documents `/api/documents`
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/upload` | Upload file (pdf, docx, txt) — extract and normalise text |
| POST | `/paste` | Paste raw text directly |
| GET | `/` | List documents (filtered by `project_id`) |
| GET | `/{doc_id}` | Get document full text and HTML |
| DELETE | `/{doc_id}` | Delete document and clean vector embeddings |

### Codes `/api/codes`
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/` | Create code (prevents duplicate labels within project) |
| GET | `/` | List codes (filtered by `project_id`) |
| PATCH | `/{code_id}` | Update label/definition/colour (records edit events) |

### Segments `/api/segments`
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/` | Create segment → triggers background audit pipeline |
| POST | `/batch` | Batch create segments |
| GET | `/` | List segments (filtered by `document_id`) |
| DELETE | `/{segment_id}` | Delete segment + clean vector embeddings + re-audit siblings |
| GET | `/alerts` | Fetch alerts (`unread_only` optional) |
| POST | `/analyze` | Manually trigger code analysis (minimum 2 segments) |
| GET | `/analyses` | List all code analyses for a project |
| POST | `/batch-audit` | Run full project batch audit (all codes) |

### Visualisations `/api/projects/{project_id}/vis`
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/overview` | Aggregate stats + multi-metric time-series |
| GET | `/facets` | Get facet clusters (optional `code_id` filter) |
| GET | `/consistency` | Consistency metrics per code |
| GET | `/overlap` | Code overlap matrix (pairwise centroid similarity) |
| PATCH | `/facets/{facet_id}/label` | Rename facet (sets `label_source = "user"`) |
| POST | `/facets/suggest-labels` | Re-run AI label suggestion for facets of a code |
| POST | `/facets/{facet_id}/explain` | AI narrative explanation of a specific facet sub-theme |

### Edit History `/api/projects/{project_id}/edit-history`
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/` | List edit events (paginated, filterable by entity type/action) |

### System
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/settings` | Public settings (has_api_key, model names) |

---

## 10. WebSocket Event Architecture

Co-Refine uses WebSocket for real-time server-to-client communication. The server maintains per-user connection sets at `/ws/{user_id}`.

**Thread-safe send**: Background audit tasks run in separate threads outside the asyncio event loop. The `ConnectionManager` in `infrastructure/websocket/manager.py` uses `asyncio.run_coroutine_threadsafe()` to safely send messages from background threads into the event loop set at startup.

### 10.1 WebSocket Event Types (17 Types)

All constants are defined in `core/events.py`:

| Event Type | Purpose |
|-----------|---------|
| `agents_started` | Audit pipeline has begun for a segment |
| `agents_done` | Audit pipeline complete |
| `agent_thinking` | An audit agent (e.g., `"coding_audit"` or `"analysis"`) is processing |
| `agent_error` | An audit agent encountered an error |
| `deterministic_scores` | Stage 1 complete — carries `centroid_similarity`, `is_pseudo_centroid`, `temporal_drift`, `segment_count` |
| `coding_audit` | Stage 2 complete — carries full audit result JSON |
| `analysis_updated` | Auto-analysis completed — carries inferred `definition`, `lens`, `reasoning` |
| `batch_audit_started` | Batch audit has begun — carries `total_codes` |
| `batch_audit_progress` | Batch progress tick — carries `completed`, `total`, `code_label`, `skipped` flag |
| `batch_audit_done` | Batch audit complete |
| `code_overlap_matrix` | Code redundancy matrix computed — carries nested `{code_label → {code_label → similarity}}` |
| `temporal_drift_warning` | A code's centroid has drifted above threshold — carries `avg_drift` |
| `facet_updated` | Facet clustering has been recomputed — carries updated facets array |
| `chat_stream_start` | Chat response generation beginning |
| `chat_token` | Single streaming token — carries `token` string |
| `chat_done` | Chat response complete |
| `chat_error` | Chat generation failed |

---

## 11. Visualisation Dashboard

The Visualisation tab (`features/visualisations/`) provides three panels loaded via `/api/projects/{id}/vis/*`:

### 11.1 Overview Tab
- **KPI cards**: `total_segments`, `total_codes`, `avg_consistency` (mean LLM consistency score), `avg_centroid_sim` (mean embedding similarity), `escalation_rate` (always 0 currently — field preserved for future use)
- **Time-series chart**: Daily `avg_consistency` and `avg_centroid_sim` trends over time, sourced from the `ConsistencyScore` append-only table.

### 11.2 Facet Explorer Tab
The Facet Explorer is the primary sub-theme discovery interface. It shows:
- A scatter plot of all coded segments in 2D t-SNE space, coloured by facet assignment
- Facet cards listing the segments in each cluster
- Facet label editing (researcher can rename AI-generated labels)
- Per-facet "Explain" button that triggers the `/facets/{facet_id}/explain` endpoint for a narrative synthesis

### 11.3 Consistency Tab
Per-code consistency metrics:
- Mean `llm_consistency_score` and `llm_intent_score` per code
- `avg_centroid_sim` per code
- Segment count per code
- Temporal drift value (where available — requires 10+ segments)

---

## 12. Configuration and Settings

**Location**: `backend/core/config.py` — `Settings` class (Pydantic `BaseSettings`, loaded from `.env`)

```
app_title = "Co-Refine"

# Azure OpenAI
azure_api_key, azure_endpoint, azure_api_version
azure_deployment_fast       # Fast model deployment (used for chat streaming + facet labelling)
azure_deployment_reasoning  # Reasoning model deployment (used for all audit + analysis LLM calls)
azure_embedding_model       # Azure embedding deployment (empty = use local SentenceTransformer)
fast_model = "gpt-5-mini"
reasoning_model = "gpt-5.2"
embedding_model = "local"

# Thresholds
min_segments_for_consistency = 3
auto_analysis_threshold = 3
vector_search_top_k = 8

stage_divergence_threshold = 0.25       # Legacy field (kept for DB compat)
drift_warning_threshold = 0.3           # Temporal drift above this triggers warning
code_overlap_warning_threshold = 0.85   # Centroid overlap above this flags code pair

# Storage
database_url = "sqlite:///./inductive_lens.db"
chroma_persist_dir = "./chroma_data"
```

**Per-project threshold overrides**: `Project.thresholds_json` stores a JSON object of per-project threshold overrides. `get_threshold(key, project_thresholds)` in `core/config.py` merges project overrides with global defaults.

---

## 13. LLM Integration

### 13.1 Client (`infrastructure/llm/client.py`)

`call_llm(prompt, model=None, retries=1) → dict`

- Initialises a singleton `AzureOpenAI` client lazily.
- Accepts either a plain string prompt (wrapped as a user message) or a full messages list.
- Uses `response_format={"type": "json_object"}` for reliable structured output.
- Retries on JSON parse failure (default 1 retry).
- Returns parsed dict or an error sentinel if all retries fail.
- Routes to either `azure_deployment_fast` or `azure_deployment_reasoning` based on the `model` parameter passed by callers.

### 13.2 JSON Parser (`infrastructure/llm/json_parser.py`)

`parse_json_response(text) → dict | PARSE_FAILED_SENTINEL`

- Handles common LLM output quirks: markdown fence stripping, control character removal, trailing comma removal
- Returns `PARSE_FAILED_SENTINEL` on total failure — callers treat sentinel as a skippable error

### 13.3 Embeddings (`infrastructure/vector_store/embeddings.py`)

**Selection strategy** (at runtime):
1. If `settings.azure_embedding_model` is set → Azure OpenAI Embeddings API
2. Otherwise → local `SentenceTransformer("all-MiniLM-L6-v2")` loaded lazily (singleton)

Both paths expose a single `embed_text(text: str) → list[float]` function.

### 13.4 Vector Store (`infrastructure/vector_store/store.py`)

- ChromaDB client persisted to `./chroma_data/`
- Per-user collection named `segments_{user_id}` with cosine distance metric
- Key operations:
  - `add_segment_embedding()` — upsert with metadata (`code`, `document_id`, `created_at`)
  - `get_all_segments_for_code()` — retrieve all segments for a code label (used for audit history)
  - `find_similar_segments()` — query by similarity with optional code filter
  - `delete_segment_embedding()` — remove embedding on segment delete

### 13.5 MMR Sampling (`infrastructure/vector_store/mmr.py`)

**Maximal Marginal Relevance** (MMR) is used to select diverse, relevant segments for the chat assistant's semantic context retrieval:

MMR score = λ · sim(query, candidate) − (1 − λ) · max_{s ∈ selected} sim(candidate, s)

where λ = 0.5 (balanced relevance/diversity, default). This ensures retrieved context represents a broad cross-section of the coding history rather than near-duplicate examples.

---

## 14. Prompt Engineering Design

Co-Refine uses four prompt builders in `backend/prompts/`:

### 14.1 Coding Audit Prompt (`prompts/audit_prompt.py`)

**Role**: "Expert Qualitative Research Auditor reviewing for SELF-CONSISTENCY"

**Key design decisions**:
- Deterministic Stage 1 scores are presented as mathematical FACTS — the LLM must ground its judgment on them
- Explicit correlation rules between embedding similarity and consistency score with allowed deviation bands
- Severity is formulaically derived (`severity = 1 - consistency_score`) with only ±0.05 adjustment allowed
- Researcher's definition is labelled "canonical"; AI-inferred is labelled "supplementary"
- Co-applied code exclusion is a HARD CONSTRAINT — prevents circular or redundant suggestions
- Cold-start handling noted in the deterministic evidence section when `is_pseudo_centroid = True`

### 14.2 Analysis Prompt (`prompts/analysis_prompt.py`)

**Role**: "Expert Qualitative Researcher specialising in thematic analysis and codebook development"

**Key design decisions**:
- Uses the reasoning model for deeper analytical capability
- Handles two cases: with and without researcher-supplied definitions
- When a researcher definition exists, the AI must compare its inferred definition and note divergence
- The "Interpretive Lens" asks the AI to articulate what analytical perspective the researcher appears to be applying

### 14.3 Chat Prompt (`prompts/chat_prompt.py`)

**Role**: "Qualitative research assistant embedded in Co-Refine"

**Key design decisions**:
- Rich context injection: codebook + semantic search results (top 8) + last 20 conversation messages
- Grounding constraint: never fabricate data, always reference specific codes and segments
- Designed to support analytical reflection, not replace it

### 14.4 Facet Label Prompt (`prompts/facet_label_prompt.py`)

**Role**: "Qualitative research assistant analysing sub-themes within a coding scheme"

**Key design decisions**:
- Concise 2–5 word labels for visual clarity in the Facet Explorer
- Must provide reasoning per label for researcher evaluation
- JSON-only output for reliable parsing

---

## 15. Database Migrations and Initialization

**Location**: `backend/core/models/migrations.py`

Lightweight `ALTER TABLE` migrations run at startup via the `lifespan` hook in `main.py`:
- Idempotent — checks if column exists before adding it
- Covers post-initial-schema column additions such as `enabled_perspectives` and `thresholds_json` on Project, `llm_predicted_codes_json` on ConsistencyScore, facet fields `suggested_label` and `label_source`, and t-SNE coordinates `tsne_x` and `tsne_y` on CodedSegment

---

## 16. Backend Architecture: Vertical Slices

All feature code lives in `backend/features/` as self-contained vertical slices. Each slice owns its router, service, repository, and schemas.

```
backend/
├── main.py                      # App factory: lifespan, CORS, router mount, WebSocket endpoint
├── core/                        # Shared kernel — no feature imports allowed
│   ├── config.py                # Pydantic Settings (from .env)
│   ├── database.py              # SQLAlchemy engine, SessionLocal, Base, get_db()
│   ├── events.py                # WebSocket event type constants (17 types)
│   ├── exceptions.py            # Domain exceptions: NotFoundError, ValidationError, etc.
│   ├── logging.py               # Structured logger setup
│   └── models/                  # One SQLAlchemy model per file; __init__.py re-exports all
├── infrastructure/              # External integration adapters
│   ├── llm/                     # AzureOpenAI client + JSON parser
│   ├── vector_store/            # ChromaDB + embeddings + MMR
│   └── websocket/               # ConnectionManager + threadsafe send
├── features/                    # Vertical slices
│   ├── projects/                # router, service, repository, schemas, constants
│   ├── documents/               # router, service, repository, schemas, file_parser
│   ├── codes/                   # router, service, repository, schemas
│   ├── segments/                # router, service, repository, schemas
│   ├── audit/                   # orchestrator, batch_auditor, sibling_auditor,
│   │                            # auto_analyzer, context_builder, score_persister,
│   │                            # router, schemas
│   ├── scoring/                 # pipeline, centroid, temporal_drift, code_overlap
│   ├── chat/                    # router, service, repository, schemas
│   ├── facets/                  # service (DB operations co-located in service.py)
│   ├── visualisations/          # router, service, schemas
│   └── edit_history/            # router, repository, schemas
├── prompts/                     # Prompt builders (audit, analysis, chat, facet_label)
└── services/
    └── ai_analyzer.py           # LLM orchestration for audit + analysis (still used by audit/)
```

### Layer Rules (STRICT)

```
features/X/router.py  →  features/X/service.py  →  features/X/repository.py
                                                 →  infrastructure/*
                                                 →  core/*
                                                 →  services/ai_analyzer.py

  ✓  feature/router   → feature/service, feature/schemas
  ✓  feature/service  → feature/repository, infrastructure/*, core/*
  ✓  feature/service  → prompts/*
  ✗  feature/A        → feature/B           (FORBIDDEN — except audit → scoring)
  ✗  core/*           → features/*          (FORBIDDEN)
  ✗  infrastructure/* → features/*          (FORBIDDEN)

EXCEPTION: features/audit/ imports from features/scoring/ — audit is the single consumer of scoring.
```

---

## 17. Frontend Architecture

### 17.1 Three-Panel Resizable Layout

The application presents a three-panel layout using `react-resizable-panels` in `app/App.tsx`:

- **Left Panel** (collapsible): Project picker dropdown, document list, code list. Selecting a project loads its documents, codes, and audit settings. Selecting a document loads segments and switches to document viewer.

- **Centre Panel**: The main content area, switching between four `viewMode` states:
  - `"document"` — Annotated document viewer (or upload page)
  - `"todo"` — Default state when no document is selected
  - `"analysis"` — Visualisation dashboard (Overview, Facet Explorer, Consistency tabs)
  - `"history"` — Edit history timeline

- **Right Panel** (collapsible, visible when a document is active): Two tabs — **Alerts** (audit pipeline results) and **Chat** (conversational assistant).

Keyboard shortcuts: `Ctrl+B` toggles the left panel; `Ctrl+J` toggles the right panel. Layout proportions are persisted in `localStorage`.

### 17.2 Zustand Store (Slice-Based)

`shared/store/store.ts` composes all slices into a single `AppState`:

| Slice | Key State | Key Actions |
|-------|-----------|------------|
| `UiSlice` | `viewMode`, `rightPanelTab`, `showUploadPage`, `selectedVisCodeId` | `setViewMode`, `setRightPanel` |
| `ProjectSlice` | `projects[]`, `activeProjectId` | `loadProjects`, `createProject`, `deleteProject` |
| `DocumentSlice` | `documents[]`, `activeDocumentId` | `loadDocuments`, `deleteDocument` |
| `CodeSlice` | `codes[]`, `activeCodeId`, `searchQuery` | `loadCodes`, `createCode`, `updateCode`, `deleteCode` |
| `SegmentSlice` | `segments[]`, `pendingApplications[]`, `scrollToSegmentId` | `loadSegments`, `applyCode`, `removeSegment` |
| `AuditSlice` | `alerts[]`, `auditStage`, `batchAudit{}`, `agentsRunning` | `loadAlerts`, `updateAlert`, `setBatchAuditStatus` |
| `ChatSlice` | `chatMessages[]`, `streaming`, `conversationId` | `sendMessage`, `appendToken`, `createConversation` |
| `HistorySlice` | `editHistory[]`, `historyScope{}` | `loadHistory`, `filterHistory` |

### 17.3 Frontend Feature Structure

```
frontend/src/
├── app/
│   ├── App.tsx                          # Root 3-panel layout + keyboard shortcuts
│   └── main.tsx                         # React root mount
├── features/
│   ├── audit/                           # Alert display, audit progress, CodingAuditCard
│   ├── chat/                            # ChatTab (stream orchestration)
│   ├── codes/                           # CodesTabContent, CodeListItem, ExpandedCodeDetail
│   ├── documents/                       # DocumentUpload, DocumentViewer, MarginPills
│   ├── history/                         # EditHistoryView, HistoryTimeline, CodeChangeBanner
│   ├── project/                         # AgentSettingsModal (perspectives + thresholds)
│   ├── selection/                       # HighlightPopover, SelectionView, ClickedSegmentsView
│   └── visualisations/                  # VisOverviewTab, FacetExplorerTab, ConsistencyTab
├── widgets/                             # LeftPanel, RightPanel, Toolbar, StatusBar
└── shared/
    ├── api/client.ts                    # Fetch wrapper for all API endpoints
    ├── hooks/useWebSocket.ts            # WS event dispatcher → store
    ├── lib/                             # utils (cn, hexToRgba), constants, annotated-text, alert-helpers
    ├── store/                           # Composed Zustand store (slices)
    ├── types/index.ts                   # All TypeScript interfaces (source of truth)
    └── ui/                             # Badge, IconButton shared atoms
```

### 17.4 Document Viewer and Annotation System

1. `buildAnnotatedText()` (pure function in `shared/lib/annotated-text.ts`) takes the document's full text, all segments, and flagged segment IDs. Produces HTML with `<mark data-start="..." data-end="...">` tags. Normal segments: indigo highlight; flagged (inconsistent): red highlight with border.
2. **Margin pills** (`MarginPills.tsx`): 44px column with code-coloured pills at the vertical position of each segment for at-a-glance coding density.
3. **Click interaction**: Clicking a `<mark>` element identifies matching segments and opens `ClickedSegmentsView` showing full segment details.
4. **Scroll-to-segment**: When `scrollToSegmentId` is set (e.g., from clicking an alert), the viewer scrolls to and highlights the corresponding element.

### 17.5 TypeScript Types (`shared/types/index.ts`)

All frontend types are defined here as the single source of truth:

- **DTOs**: `ProjectOut`, `DocumentOut`, `CodeOut`, `SegmentOut`, `AnalysisOut`, `AlertOut`
- **WebSocket payload**: `AlertPayload` — union type covering all 17 event types
- **Deterministic scores**: `DeterministicScores` — `centroid_similarity`, `is_pseudo_centroid`, `temporal_drift`, `segment_count`
- **Reflection metadata** (backward compat): `ReflectionMeta`, `ScoreDelta` — fields persist for future implementation
- **Challenge metadata** (backward compat): `ChallengeMeta`, `ChallengeReflectionResponse` — fields persist for future implementation

---

## 18. Edit History and Audit Trail

Co-Refine maintains a complete, immutable audit trail of every mutation through the `EditEvent` table:

- **Segment creation/deletion**: Records `entity_type="segment"`, `action="created"/"deleted"`, with segment text, code label, and document reference
- **Code creation/update/deletion**: Records the specific `field_changed` (`label`, `definition`, `colour`) with `old_value` and `new_value`

The edit history frontend presents a chronological timeline (`EditHistoryView`) with scope selector (project-wide or document-specific), diff-style `CodeChangeBanner` for code mutations, and pagination for large histories.

---

## 19. Running the Application

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Setup
Create `backend/.env`:
```
AZURE_API_KEY=your_key
AZURE_ENDPOINT=your_endpoint
AZURE_API_VERSION=2024-02-15-preview
AZURE_DEPLOYMENT_FAST=your_fast_deployment_name
AZURE_DEPLOYMENT_REASONING=your_reasoning_deployment_name
# Leave AZURE_EMBEDDING_MODEL empty to use local SentenceTransformer
```

If no API key is configured, the app runs with the document viewer, codebook management, and history features fully functional. AI-dependent features (audit pipeline, chat, analysis) are silently skipped.

---

## 20. Known Architecture Notes

1. **`distribution.py` is empty**: `features/scoring/distribution.py` previously implemented softmax codebook distribution scoring (entropy, conflict score). This was removed; the file contains only a removal comment. Stage 1 currently produces three metrics: centroid similarity, temporal drift, segment count.

2. **Legacy root-level files**: `backend/routers/`, `backend/services/` (except `services/ai_analyzer.py`), `backend/models.py`, and `backend/database.py` are retained from a prior architecture. They are **not imported by `main.py`** and are unused in the active application.

3. **`services/ai_analyzer.py` is still used**: The refactored vertical-slice architecture has not yet extracted `ai_analyzer.py` into a feature service. `features/audit/orchestrator.py` and `features/audit/batch_auditor.py` both import from `services.ai_analyzer`.

4. **No challenge endpoint**: The `ChallengeRequest`/`ChallengeResponse` schemas exist in `features/audit/schemas.py` and frontend types include `ChallengeMeta` and `ChallengeReflectionResponse`, but no challenge route is mounted in the active router. The challenge feature fields in `ConsistencyScore` are preserved for future implementation.

5. **`facets/` has no `repository.py`**: All facet DB operations are handled within `features/facets/service.py` directly.

6. **No reflection pass**: The `was_reflected` field exists in `ConsistencyScore` for backward compatibility and future implementation. The current pipeline makes a single LLM call per segment — no reflection loop exists.
