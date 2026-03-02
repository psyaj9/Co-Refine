# Co-Refine: Backend Coding Audit Pipeline

> Complete technical reference for the 3-stage consistency pipeline that audits every coding decision in real-time.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Trigger: How an Audit Starts](#trigger-how-an-audit-starts)
3. [Stage 1 — Deterministic Embedding Scores](#stage-1--deterministic-embedding-scores)
4. [Stage 2 — LLM Judgment (Coding Audit)](#stage-2--llm-judgment-coding-audit)
5. [Stage 3 — Escalation to Reasoning Model](#stage-3--escalation-to-reasoning-model)
6. [Analysis Agent (Separate Pipeline)](#analysis-agent-separate-pipeline)
7. [Batch Audit](#batch-audit)
8. [Data Model](#data-model)
9. [Configuration Reference](#configuration-reference)
10. [WebSocket Event Reference](#websocket-event-reference)
11. [Literature Grounding](#literature-grounding)

---

## Architecture Overview

```
User highlights text in document
        │
        ▼
 POST /api/segments/   ──────────────────────────────────────────────────┐
        │                                                                │
        ▼                                                                │
 CodedSegment persisted to SQLite                                        │
 EditEvent audit trail created                                           │
        │                                                                │
        ▼                                                                │
 _run_background_agents() fired as FastAPI BackgroundTask                │
        │                                                                │
        ├─── Step 1: Embed segment ──► ChromaDB (cosine collection)      │
        │                                                                │
        ├─── Step 2: STAGE 1 — Deterministic Scoring (scoring.py)        │
        │         Pure math on embeddings. No LLM. Reproducible.         │
        │         → WS event: "deterministic_scores"                     │
        │                                                                │
        ├─── Step 3: STAGE 2 — LLM Coding Audit (ai_analyzer.py)        │
        │         Fast model (gpt-5-mini). Grounded on Stage 1.          │
        │         Two lenses: Self-Consistency + Inter-Rater              │
        │         │                                                      │
        │         └── STAGE 3: Escalation check                          │
        │              If Stage 1 ↔ Stage 2 diverge → re-run on          │
        │              reasoning model (gpt-5.2)                         │
        │         → WS event: "coding_audit"                             │
        │         → Persist: AgentAlert + ConsistencyScore               │
        │                                                                │
        └─── Step 4: Auto-Analysis (if threshold met)                    │
                  Reasoning model infers operational definition           │
                  → WS event: "analysis_updated"                         │
                  → Persist: AnalysisResult                              │
```

**Key design principle**: Stage 1 scores are *facts* — deterministic, reproducible, and computed purely from embedding geometry. Stage 2 is an LLM *opinion* that must stay anchored to Stage 1 facts (±0.15 deviation). Stage 3 exists as a safety net when Stages 1 and 2 disagree.

---

## Trigger: How an Audit Starts

### Per-Segment (Real-Time)

**File**: `backend/routers/segments.py` → `POST /api/segments/`

When a user highlights text and assigns a code:

1. A `CodedSegment` row is created in SQLite with `start_index`, `end_index`, `text`, `code_id`, `document_id`, `user_id`
2. An `EditEvent` is recorded (audit trail)
3. A surrounding context window is extracted from the document's `full_text` (±500 chars around the highlight)
4. `_run_background_agents()` is fired as a `BackgroundTask` — **non-blocking**, the API returns immediately

**Guard**: Background agents only run if `settings.azure_api_key` is configured. Without it, segments are still created but no audit runs.

### Batch (Project-Wide)

**File**: `backend/routers/segments.py` → `POST /api/segments/batch-audit`

Runs the audit for **every code** in a project using MMR diversity sampling to pick representative segments per code. This is typically triggered manually from the UI. At the end, the code overlap matrix is also computed.

---

## Stage 1 — Deterministic Embedding Scores

**File**: `backend/services/scoring.py`  
**Entry point**: `compute_stage1_scores()`  
**LLM calls**: Zero. Pure math on embeddings.  
**Embedding model**: Azure `text-embedding-3-small` (1536 dimensions)

### How Embeddings Work

Every coded segment has its text embedded via `embed_text()` in `vector_store.py`. These 1536-dimensional vectors are stored in ChromaDB in per-user collections (`segments_{user_id}`) with cosine distance metric. Each embedding has metadata: `code` (label), `document_id`, `text_preview`, `created_at`.

A **code centroid** is the L2-normalised mean of all embedding vectors for segments assigned to that code. This represents the "semantic centre" of how the researcher is using that code.

### Metric 1: Centroid Similarity

| Property | Value |
|---|---|
| **Function** | `segment_to_centroid_similarity()` |
| **Formula** | $\text{cosine}(\vec{v}_{\text{segment}}, \vec{c}_{\text{code}})$ |
| **Range** | [0.0, 1.0] |
| **Literature** | Thematic-LM |
| **Interpretation** | How semantically similar this segment is to everything else coded with this label |

**How it works**:
1. Fetch all embeddings from ChromaDB where `code == proposed_code`
2. Compute their L2-normalised mean → this is the **code centroid** $\vec{c}$
3. Embed the new segment text → $\vec{v}$
4. Return $\text{cosine}(\vec{v}, \vec{c})$

**Cold-start fallback**: If the code has 0 segments in ChromaDB, the user's written code definition is embedded as a **pseudo-centroid**. This is flagged with `is_pseudo_centroid = true` so downstream consumers know the score is less reliable.

**Thresholds used in Stage 2 grounding**:
- similarity ≥ 0.75 → LLM consistency_score must be ≥ 0.65
- similarity ≤ 0.40 → LLM consistency_score must be ≤ 0.45

### Metric 2: Codebook Probability Distribution

| Property | Value |
|---|---|
| **Function** | `compute_codebook_distribution()` → `softmax_scores()` |
| **Formula** | $P(\text{code}_i) = \frac{e^{s_i / T}}{\sum_j e^{s_j / T}}$ where $s_i = \text{cosine}(\vec{v}_{\text{segment}}, \vec{c}_i)$ |
| **Range** | Each code gets a probability in [0, 1], sum = 1.0 |
| **Literature** | ITA-GPT |
| **Temperature** | Configurable via `softmax_temperature` (default 1.0) |

**How it works**:
1. For every code in the project's codebook, compute its centroid
2. Compute cosine similarity between the segment embedding and each centroid → raw scores
3. Apply softmax with temperature $T$ to normalise into a probability distribution
4. Codes with no segments get score 0.0

**Interpretation**: This tells you "given the embedding space geometry, which codes does this segment most likely belong to?" High probability for the proposed code = good. Spread across codes = ambiguous.

The softmax uses numerically stable computation: subtract max before exponentiating.

### Metric 3: Entropy

| Property | Value |
|---|---|
| **Function** | `distribution_entropy()` |
| **Formula** | $H_{\text{norm}} = \frac{-\sum_i P_i \ln P_i}{\ln N}$ |
| **Range** | [0.0, 1.0] (normalised) |
| **Literature** | ITA-GPT (derived) |
| **Interpretation** | 0 = perfectly certain (one code dominates), 1 = maximally uncertain (uniform) |

**How it works**: Takes the softmax probability distribution and computes its Shannon entropy, normalised by $\ln(N)$ where $N$ is the number of codes. This normalisation ensures the range is [0, 1] regardless of codebook size.

**Why it matters**: Entropy is the single best scalar for "how ambiguous is this coding decision?" A high entropy means the segment could plausibly belong to multiple codes. This is independent of which specific code was proposed.

### Metric 4: Conflict Score

| Property | Value |
|---|---|
| **Function** | `conflict_score()` |
| **Formula** | $1 - P(\text{proposed\_code})$ |
| **Range** | [0.0, 1.0] |
| **Literature** | Derived from ITA-GPT |
| **Interpretation** | 0.0 = no conflict (proposed code dominates), 1.0 = maximum conflict |

Simple complement of the proposed code's softmax probability. When conflict is high, the embedding space says "this segment doesn't look like it belongs to the code you chose."

### Metric 5: Proposed Code Probability

| Property | Value |
|---|---|
| **Function** | Direct lookup from softmax distribution |
| **Formula** | $P(\text{proposed\_code})$ from the softmax |
| **Range** | [0.0, 1.0] |
| **Interpretation** | The embedding space's "vote" for the proposed code. Higher = more aligned. |

This is just the flip side of conflict_score, stored separately for convenience.

### Metric 6: Temporal Drift

| Property | Value |
|---|---|
| **Function** | `compute_temporal_drift()` |
| **Formula** | $1 - \text{cosine}(\vec{c}_{\text{old}}, \vec{c}_{\text{recent}})$ |
| **Range** | [0.0, 1.0], None if insufficient segments |
| **Literature** | LOGOS |
| **Window** | 5 oldest segments vs 5 most recent segments |
| **Warning threshold** | > 0.3 = meaningful drift |

**How it works**:
1. Fetch all embeddings for the code from ChromaDB
2. Sort by `created_at` timestamp
3. Compute centroid of the 5 oldest → $\vec{c}_{\text{old}}$
4. Compute centroid of the 5 most recent → $\vec{c}_{\text{recent}}$
5. Return cosine **distance** (1 − similarity)

**Interpretation**: If a researcher starts coding "Emotional Distress" with segments about sadness, but gradually drifts into coding anger-related content with the same label, the drift score will increase. A score > 0.3 suggests the researcher's interpretation of this code is shifting over time — a known challenge in qualitative research called "concept drift."

**Minimum data**: Requires at least `window_recent + window_old` (10) segments. Returns `None` otherwise.

### Metric 7: Segment Count

| Property | Value |
|---|---|
| **Source** | ChromaDB collection count with code filter |
| **Purpose** | Cold-start awareness |

The number of segments coded with this label. Used by the LLM prompt to weight its confidence — fewer segments mean the centroid is less stable and the LLM should weight codebook definitions more heavily.

### Metric 8: Is Pseudo Centroid

| Property | Value |
|---|---|
| **Source** | `get_code_centroid_with_fallback()` |
| **Type** | Boolean |
| **Purpose** | Flags when the centroid was derived from the code definition text rather than actual coded segments |

When `True`, all centroid-based scores (similarity, distribution, entropy) should be treated as less reliable.

### Code Overlap Matrix (Project-Level)

| Property | Value |
|---|---|
| **Function** | `compute_code_overlap_matrix()` |
| **Formula** | Pairwise $\text{cosine}(\vec{c}_a, \vec{c}_b)$ for all code pairs |
| **Literature** | GATOS |
| **Warning threshold** | > 0.85 = potential redundancy |

Not computed per-segment — computed at the end of batch audits or on-demand via `GET /api/evaluation/code-overlap`. High overlap between two code centroids suggests the codes capture semantically similar content and might be candidates for merging.

### Stage 1 Output

`compute_stage1_scores()` returns:

```python
{
    "centroid_similarity": 0.7832,      # float | None
    "is_pseudo_centroid": False,         # bool
    "codebook_prob_dist": {              # dict[str, float]
        "Emotional Distress": 0.412,
        "Coping Strategy": 0.298,
        "Social Support": 0.183,
        ...
    },
    "entropy": 0.6541,                  # float
    "conflict_score": 0.588,            # float (1 - proposed_code_prob)
    "proposed_code_prob": 0.412,         # float
    "temporal_drift": 0.1823,            # float | None
    "segment_count": 14,                # int
}
```

This is sent to the frontend via WebSocket as a `"deterministic_scores"` event and also passed directly into Stage 2.

---

## Stage 2 — LLM Judgment (Coding Audit)

**Files**: `backend/services/ai_analyzer.py` → `run_coding_audit()`, `backend/prompts/coding_audit_prompt.py`  
**Model**: Fast model (`gpt-5-mini` via Azure deployment)  
**Input**: Stage 1 scores + rich context (history, definitions, document window)

### What the LLM Receives

The prompt is constructed by `build_coding_audit_prompt()` and consists of two messages:

**System Message** — defines the auditor role, scoring rules, and required JSON output structure.

**User Message** — contains 7 sections:

| Section | Source | Purpose |
|---|---|---|
| **Document Context** | `_extract_window()` from `segments.py` | ±500 chars around the highlighted text, with `>>>` markers around the actual segment |
| **Deterministic Evidence** | Stage 1 scores formatted as text | FACTS the LLM must respect — centroid similarity, softmax distribution, entropy, drift |
| **Researcher's Codebook** | `Code.definition` for all codes in project | Canonical definitions with softmax P() annotations |
| **AI-Inferred Definitions** | `AnalysisResult` table | Supplementary definitions + interpretive lens from the Analysis Agent |
| **Coding History** | MMR-diverse sample of 10 segments | Representative examples of how this code has been used |
| **New Coding Decision** | The segment text + proposed code | What's being audited |
| **Co-Applied Codes** | Overlapping segments on same text span | Codes already applied that should NOT be suggested as alternatives |

### MMR Diversity Sampling for History

**File**: `backend/services/vector_store.py` → `find_diverse_segments()`

Instead of showing the LLM the most *similar* past segments (which would be redundant), we use **Maximal Marginal Relevance** to select segments that are both relevant to the current segment AND diverse from each other:

$$\text{MMR}(d_i) = \lambda \cdot \text{sim}(q, d_i) - (1-\lambda) \cdot \max_{d_j \in S} \text{sim}(d_i, d_j)$$

Where:
- $q$ = current segment embedding
- $d_i$ = candidate segment embedding
- $S$ = already-selected segments
- $\lambda = 0.5$ (equal weight to relevance and diversity)

This iteratively selects up to 10 segments that collectively give the LLM the broadest view of how the code has been used.

### Two Audit Lenses

The LLM performs two independent analyses in a single call:

#### Lens 1: Self-Consistency

> "Did the researcher apply this code consistently with their own past decisions?"

| Output Field | Type | Description |
|---|---|---|
| `is_consistent` | bool | Binary judgment: consistent or not |
| `consistency_score` | float [0–1] | **Must be anchored to centroid_similarity** (±0.15 max deviation) |
| `intent_alignment_score` | float [0–1] | How well the quote matches the *intended meaning* of the code. Semantic judgment, can diverge from consistency_score |
| `reasoning` | string | Step-by-step justification |
| `definition_match` | string | How well the segment matches the code definition |
| `drift_warning` | string | Whether interpretation appears to be shifting (empty if no drift) |
| `alternative_codes` | list[str] | Better-fitting codes from the codebook (excluding co-applied codes) |
| `suggestion` | string | Brief constructive suggestion for the researcher |

#### Lens 2: Inter-Rater Reliability

> "What would an independent second researcher code this segment as?"

| Output Field | Type | Description |
|---|---|---|
| `predicted_codes` | list[dict] | Ranked top-5 codes with `code`, `confidence`, `reasoning` for each |
| `is_conflict` | bool | True if top prediction differs from proposed code AND all co-applied codes |
| `conflict_severity_score` | float [0–1] | How severe the disagreement is. Must be < 0.3 if `is_conflict=false` |
| `reasoning` | string | Overall rationale based on codebook and patterns |
| `conflict_explanation` | string | Why a second researcher would disagree (empty if no conflict) |

Each `predicted_code` confidence is **anchored to the softmax P() value as a floor** — the LLM cannot give a code less confidence than the embedding space suggests.

#### Overall Scores

| Output Field | Type | Description |
|---|---|---|
| `overall_severity_score` | float [0–1] | $\max(1 - \text{consistency\_score},\; \text{conflict\_severity\_score} \times 0.8)$ with ±0.05 contextual adjustment |
| `overall_severity` | string | "high" (≥0.65), "medium" (0.35–0.64), "low" (<0.35) |
| `score_grounding_note` | string | How the LLM used the embedding evidence |

### LLM Grounding Rules

The system prompt enforces hard constraints to prevent the LLM from ignoring Stage 1 evidence:

1. **Consistency score anchoring**: If centroid similarity ≥ 0.75, the LLM's consistency_score must be ≥ 0.65. If similarity ≤ 0.40, consistency_score must be ≤ 0.45. Deviation > ±0.15 requires explicit justification.

2. **Confidence floor**: Each predicted code's confidence must be at least as high as its softmax P() value.

3. **Conflict-severity coherence**: If `is_conflict=false`, then `conflict_severity_score` must be < 0.3.

4. **Severity formula**: `overall_severity_score` is computed from a specific formula, with only ±0.05 adjustment allowed.

5. **Severity label matching**: The string label must match the numeric score (≥0.65 → "high", etc.)

### Perspective Filtering

Projects can enable/disable lenses via `enabled_perspectives` (stored on the `Project` table):
- `["self_consistency"]` — only Lens 1
- `["inter_rater"]` — only Lens 2
- `["self_consistency", "inter_rater"]` — both (default)

When a lens is disabled, the prompt tells the LLM to return `null` for that lens.

### Post-Processing

After the LLM returns, `_run_background_agents()` applies corrections:

1. **Filter alternative codes**: Remove any codes already applied to this text span
2. **Force is_conflict=False**: If the predicted top code is already applied to the span, there's no real conflict
3. **Filter predicted_codes list**: Remove any codes already applied to the span
4. **Normalise predicted_codes format**: Handle both single-code (legacy) and ranked-list (current) LLM response formats

---

## Stage 3 — Escalation to Reasoning Model

**File**: `backend/services/ai_analyzer.py` → inside `run_coding_audit()`  
**Model**: Reasoning model (`gpt-5.2` via Azure deployment)

Stage 3 is not a separate step — it's a conditional **re-run** of Stage 2 on a more capable model when the fast model's output is suspicious.

### Escalation Triggers

Three conditions are checked (any one triggers escalation):

| # | Condition | Threshold | Rationale |
|---|---|---|---|
| 1 | **Stage divergence** | $\lvert\text{centroid\_similarity} - \text{llm\_consistency\_score}\rvert > 0.25$ | The LLM contradicts the embedding evidence |
| 2 | **High severity** | `llm_severity ≥ 0.65` | The LLM itself flagged this as serious — worth a second opinion |
| 3 | **Entropy conflict** | entropy > 0.7 AND llm_conflict < 0.3 | Embeddings say "ambiguous" but LLM dismisses concerns |

### What Happens on Escalation

1. The **exact same prompt** is sent to the reasoning model (`gpt-5.2`)
2. The reasoning model's response **completely replaces** the fast model's response
3. Metadata is attached: `_escalation: { was_escalated: true, reason: "stage_divergence=0.312" }`

### Robustness

The `_to_float()` helper safely coerces LLM outputs to floats, handling:
- Numeric strings
- Ordinal strings ("high" → 0.9, "medium" → 0.6, "low" → 0.3)
- None values (uses defaults)
- Type errors (uses defaults)

---

## Analysis Agent (Separate Pipeline)

**Files**: `backend/services/ai_analyzer.py` → `analyze_quotes()`, `backend/prompts/analysis_prompt.py`  
**Model**: Reasoning model (`gpt-5.2`) — always used for analysis (not the fast model)

This is a **separate pipeline** from the coding audit. It infers what a code *means* based on observed usage.

### When It Runs

**Auto-trigger**: After coding a segment, if:
- The code has ≥ `auto_analysis_threshold` (default 3) segments, AND
- At least `auto_analysis_threshold` new segments have been added since the last analysis (or no analysis exists yet)

**Manual trigger**: `PUT /api/codes/{code_id}/definition` endpoint also runs analysis in the background.

### What It Does

Sends ALL segments for a code to the reasoning model with a prompt asking:

1. **Operational definition**: What does this code actually mean based on how it's been applied?
2. **Interpretive lens**: What framework/perspective is the researcher using?
3. **Divergence detection**: If the researcher supplied a definition, how does practice differ from stated intent?

### Output

```python
{
    "definition": "A precise operational definition inferred from patterns...",
    "lens": "The interpretive framework the researcher appears to use",
    "reasoning": "Step-by-step justification..."
}
```

Persisted to `AnalysisResult` table. **These AI-inferred definitions are fed back into future audit prompts** as supplementary context alongside the researcher's own definitions.

---

## Batch Audit

**File**: `backend/routers/segments.py` → `POST /api/segments/batch-audit` → `_run_batch_audit_background()`

### Flow

1. Load all codes for the project
2. Build shared context: codebook definitions + AI-inferred definitions
3. For each code:
   a. Use MMR diversity sampling to pick representative segments
   b. Compute Stage 1 scores for each sampled segment
   c. Run `run_coding_audit()` (Stage 2 + 3)
   d. Persist `ConsistencyScore` + `AgentAlert` rows
   e. Send `"coding_audit"` WS events with `batch: true`
   f. Send progress updates via WS
4. After all codes: compute `compute_code_overlap_matrix()` and send via WS as `"code_overlap_matrix"`

### Progress Tracking

WebSocket events during batch:
- `"batch_audit_started"` with `total_codes` count
- `"batch_audit_progress"` with `current`/`total`/`code_label`
- `"coding_audit"` per segment (with `batch: true`)
- `"code_overlap_matrix"` at end
- `"batch_audit_complete"` with summary

---

## Data Model

### ConsistencyScore Table

**File**: `backend/database.py`

One row per audited segment. Append-only — never updated, only inserted. This creates a full evaluation trail.

| Column | Type | Stage | Description |
|---|---|---|---|
| `id` | String (PK) | — | UUID |
| `segment_id` | String (FK) | — | Link to `coded_segments` |
| `code_id` | String (FK) | — | Link to `codes` |
| `user_id` | String | — | Who coded it |
| `project_id` | String (FK) | — | Project context |
| `centroid_similarity` | Float | 1 | cosine(segment, code_centroid) [0,1] |
| `is_pseudo_centroid` | Boolean | 1 | Was definition-based fallback used? |
| `proposed_code_prob` | Float | 1 | P(proposed_code) from softmax [0,1] |
| `entropy` | Float | 1 | Normalised Shannon entropy [0,1] |
| `conflict_score` | Float | 1 | 1 − proposed_code_prob [0,1] |
| `temporal_drift` | Float | 1 | Centroid drift for this code [0,1] |
| `codebook_distribution` | JSON | 1 | Full {code: probability} dict |
| `llm_consistency_score` | Float | 2 | LLM's self-consistency judgment [0,1] |
| `llm_intent_score` | Float | 2 | LLM's intent alignment judgment [0,1] |
| `llm_conflict_severity` | Float | 2 | Inter-rater conflict severity [0,1] |
| `llm_overall_severity` | Float | 2 | Combined severity score [0,1] |
| `llm_predicted_code` | String | 2 | Top inter-rater prediction |
| `llm_predicted_confidence` | Float | 2 | Confidence of top prediction [0,1] |
| `llm_predicted_codes_json` | JSON | 2 | Ranked list [{code, confidence, reasoning}] |
| `was_escalated` | Boolean | 3 | Did this go to reasoning model? |
| `escalation_reason` | String | 3 | Why (e.g., "stage_divergence=0.312") |
| `created_at` | DateTime | — | Timestamp |

### Other Relevant Tables

| Table | Purpose |
|---|---|
| `Project` | Groups docs + codes; `enabled_perspectives` JSON column controls which lenses run |
| `Document` | Uploaded text with `full_text`, `html_content` |
| `Code` | Label, user `definition`, colour, `project_id` |
| `CodedSegment` | Text span with `start_index`/`end_index`, links to Code + Document |
| `AnalysisResult` | AI-inferred `definition` + `lens` + `reasoning` for a code |
| `AgentAlert` | Full audit payload as JSON, linked to segment. Has `is_read` for UI |
| `EditEvent` | Audit trail for all mutations (segment create/update/delete, code changes) |
| `ChatMessage` | Persisted RAG chat conversations |

### ChromaDB (Vector Store)

- **Engine**: ChromaDB with persistent storage at `./chroma_data`
- **Collections**: One per user — `segments_{user_id}` with cosine distance
- **Embedding model**: Azure `text-embedding-3-small` (1536 dimensions)
- **Metadata per vector**: `code` (label), `document_id`, `text_preview` (first 300 chars), `created_at`
- **Embedding function**: External (computed by `embed_text()`, not Chroma's built-in)

---

## Configuration Reference

**File**: `backend/config.py` (loaded from `.env`)

| Setting | Default | Env Var | Purpose |
|---|---|---|---|
| `azure_api_key` | "" | `AZURE_API_KEY` | Azure OpenAI authentication |
| `azure_endpoint` | "" | `AZURE_ENDPOINT` | Azure OpenAI endpoint URL |
| `azure_api_version` | "" | `AZURE_API_VERSION` | API version |
| `azure_deployment_fast` | "" | `AZURE_DEPLOYMENT_FAST` | Fast model deployment name (gpt-5-mini) |
| `azure_deployment_reasoning` | "" | `AZURE_DEPLOYMENT_REASONING` | Reasoning model deployment name (gpt-5.2) |
| `azure_embedding_model` | "" | `AZURE_EMBEDDING_MODEL` | Embedding model deployment name (text-embedding-3-small) |
| `embedding_model` | "local" | `EMBEDDING_MODEL` | Legacy: "local" for sentence-transformers fallback |
| `min_segments_for_consistency` | 3 | — | Minimum segments before consistency scoring activates |
| `auto_analysis_threshold` | 3 | — | Segments before auto-analysis triggers |
| `vector_search_top_k` | 8 | — | Default similarity search results count |
| `stage_divergence_threshold` | 0.25 | — | \|centroid_sim − llm_score\| above this triggers Stage 3 escalation |
| `softmax_temperature` | 1.0 | — | Temperature for codebook softmax (lower = more peaked) |
| `drift_warning_threshold` | 0.3 | — | Temporal drift above this triggers a warning |
| `code_overlap_warning_threshold` | 0.85 | — | Centroid overlap above this flags code pair as potentially redundant |

### Embedding Routing Logic

```python
# vector_store.py
def _embed_text(text: str) -> list[float]:
    if settings.azure_embedding_model:   # If Azure deployment is configured → use it
        return _embed_api(text)
    return _embed_local(text)            # Otherwise fall back to local sentence-transformers
```

---

## WebSocket Event Reference

All events are sent via `ws_manager.send_alert_threadsafe()` to the user who created the segment.

| Event Type | When | Key Payload Fields |
|---|---|---|
| `agents_started` | Background agents begin | `segment_id` |
| `deterministic_scores` | Stage 1 complete | `segment_id`, `code_id`, `data` (all Stage 1 scores) |
| `agent_thinking` | Stage 2 starting | `agent: "coding_audit"`, `segment_id` |
| `coding_audit` | Stage 2+3 complete | `segment_id`, `code_id`, `is_consistent`, `is_conflict`, `deterministic_scores`, `escalation`, `data` (full audit result) |
| `agent_thinking` | Analysis starting | `agent: "analysis"`, `segment_id` |
| `analysis_updated` | Analysis complete | `code_id`, `code_label`, `data` (definition, lens, reasoning) |
| `agent_error` | Any agent fails | `agent`, `data.message` |
| `agents_done` | All background work finished | `segment_id` |
| `batch_audit_started` | Batch begins | `total_codes` |
| `batch_audit_progress` | Per-code progress | `current`, `total`, `code_label` |
| `code_overlap_matrix` | Batch complete | `matrix` (nested dict), `warnings` (pairs > threshold) |
| `batch_audit_complete` | Batch finished | `processed`, `total` |

---

## Literature Grounding

The scoring pipeline is grounded in four published approaches:

| Reference | Used In | Contribution |
|---|---|---|
| **Thematic-LM** | `segment_to_centroid_similarity()` | Code centroid as mean embedding; segment-to-centroid cosine similarity as a consistency measure |
| **ITA-GPT** | `compute_codebook_distribution()`, `softmax_scores()`, `distribution_entropy()` | Softmax probability distribution across codebook; Shannon entropy as ambiguity metric |
| **GATOS** | `compute_code_overlap_matrix()` | Pairwise code centroid similarity to detect semantic redundancy in the codebook |
| **LOGOS** | `compute_temporal_drift()` | Rolling centroid comparison (old vs recent) to detect concept drift over time |

### Evaluation Endpoints

**File**: `backend/routers/evaluation.py`

Read-only access to pipeline data for analysis and export:

| Endpoint | Returns |
|---|---|
| `GET /api/evaluation/scores` | All `ConsistencyScore` rows for a project |
| `GET /api/evaluation/code-overlap` | Centroid overlap matrix |
| `GET /api/evaluation/drift-timeline` | Temporal drift per code |
| `GET /api/evaluation/code-cooccurrence` | How often two codes appear on the same document |
| `GET /api/evaluation/agreement-summary` | Per-code agreement between user and AI ghost coder |
| `GET /api/evaluation/document-stats` | Per-document segment/code counts |

---

## End-to-End Example

User highlights "I felt so alone after the diagnosis" and assigns code **"Emotional Distress"**.

1. **Segment created** → SQLite row + EditEvent
2. **Embedding** → `text-embedding-3-small` produces 1536-dim vector → stored in ChromaDB
3. **Stage 1**:
   - Centroid similarity: 0.78 (similar to other "Emotional Distress" segments)
   - Softmax: P("Emotional Distress") = 0.41, P("Social Isolation") = 0.32, P("Coping") = 0.15, ...
   - Entropy: 0.65 (moderately ambiguous — "Social Isolation" is close)
   - Conflict score: 0.59 (= 1 − 0.41)
   - Drift: 0.12 (stable interpretation)
4. **Stage 2** (gpt-5-mini):
   - Self-consistency: score 0.74 (anchored to 0.78 centroid sim), suggests checking "Social Isolation"
   - Inter-rater: predicts ["Emotional Distress" (0.45), "Social Isolation" (0.35), "Coping" (0.12)]
   - Overall severity: 0.26 (low)
5. **Stage 3 check**: |0.78 − 0.74| = 0.04 < 0.25 → no escalation
6. **Persisted**: ConsistencyScore row with all scores, AgentAlert with full payload
7. **WebSocket**: Frontend receives `deterministic_scores` + `coding_audit` events, renders in CodingAuditDetail panel

---

*Generated from source code analysis. Last updated: March 2026.*
