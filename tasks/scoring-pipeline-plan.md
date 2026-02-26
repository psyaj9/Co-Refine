# Multi-Stage Consistency & Similarity Pipeline — Implementation Plan

> **Goal:** Replace the current single-pass Coding Audit agent with a three-stage pipeline that produces concrete, numeric, reproducible scores — enabling proper evaluation via Cohen's kappa, precision/recall, and temporal drift analysis.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Literature Grounding](#2-literature-grounding)
3. [Architecture: Three-Stage Pipeline](#3-architecture-three-stage-pipeline)
4. [Step-by-Step Implementation](#4-step-by-step-implementation)
   - [Step 1: Expose vector_store internals](#step-1-expose-vector_store-internals)
   - [Step 2: Create scoring service](#step-2-create-scoring-service)
   - [Step 3: New database table](#step-3-new-database-table)
   - [Step 4: Restructure coding audit prompt](#step-4-restructure-coding-audit-prompt)
   - [Step 5: Update ai_analyzer.py](#step-5-update-ai_analyzerpy)
   - [Step 6: Rewire _run_background_agents](#step-6-rewire-_run_background_agents)
   - [Step 7: Update batch audit](#step-7-update-batch-audit)
   - [Step 8: Update Pydantic models](#step-8-update-pydantic-models)
   - [Step 9: New evaluation endpoints](#step-9-new-evaluation-endpoints)
   - [Step 10: Update config thresholds](#step-10-update-config-thresholds)
   - [Step 11: Update WebSocket events](#step-11-update-websocket-events)
5. [New Output Schema](#5-new-output-schema)
6. [Escalation Logic (Stage 3)](#6-escalation-logic-stage-3)
7. [Evaluation Support](#7-evaluation-support)
8. [Backward Compatibility](#8-backward-compatibility)
9. [Verification Checklist](#9-verification-checklist)

---

## 1. Problem Statement

The current Coding Audit agent produces **ordinal string scores** (`"high"/"medium"/"low"`) for consistency, confidence, and severity. These are:

- **Not reproducible** — the same segment can get different ordinal labels across runs
- **Not comparable** — `"medium"` for code A cannot be meaningfully compared to `"medium"` for code B
- **Not evaluatable** — you cannot compute precision/recall curves, Cohen's kappa, or F1 against human raters without numeric thresholds
- **Not grounded** — the LLM has no factual evidence to anchor its judgment; it can only guess

The escalation logic is also overly aggressive: it maps `"medium" → 0.6` and `"low" → 0.3`, both below the 0.7 threshold, meaning **~67% of segments escalate** to the expensive reasoning model regardless of actual severity.

---

## 2. Literature Grounding

| Framework | Technique | What we adopt | Our pipeline stage |
|---|---|---|---|
| **Thematic-LM** | Code centroid = mean embedding of all segments for a code; cosine similarity gates inclusion decisions | `segment_to_centroid_similarity()` — cosine sim between new segment and code centroid | Stage 1 |
| **ITA-GPT** | Softmax probability distribution over codebook labels; Shannon entropy as ambiguity metric | `softmax_scores()` + `distribution_entropy()` — probability distribution across all codes | Stage 1 |
| **GATOS** | Pairwise code-code semantic distance matrix for detecting semantically overlapping codes | `compute_code_overlap_matrix()` — centroid-to-centroid similarities | Stage 1 |
| **AutoTheme** | Multi-agent voting with numeric confidence aggregation → consensus score | LLM must produce float `[0.0–1.0]` scores **constrained by** Stage 1 evidence | Stage 2 |
| **LOGOS** | Temporal drift tracking via rolling embedding statistics across open-coding phases | `compute_temporal_drift()` — centroid of recent vs. old segments | Stage 1 |

**Key insight from the literature:** The strongest systems separate **deterministic computation** (embeddings, distances, distributions) from **LLM judgment** (interpretation, nuance, context). The deterministic layer provides reproducible evidence; the LLM layer adds qualitative reasoning grounded on that evidence. Escalation only triggers when the two layers **disagree**.

---

## 3. Architecture: Three-Stage Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                    STAGE 1: Deterministic Scoring             │
│                    (No LLM — pure embedding math)            │
│                                                              │
│  Inputs:  segment_text, code_label, user_id, all_code_labels │
│                                                              │
│  Computes:                                                   │
│    • centroid_similarity  — cosine(segment, code_centroid)    │
│    • codebook_prob_dist   — softmax over all code centroids   │
│    • entropy              — normalised Shannon entropy        │
│    • conflict_score       — 1 - P(proposed_code)             │
│    • temporal_drift       — centroid shift (recent vs old)    │
│                                                              │
│  Properties: fully reproducible, zero API cost, instant      │
├──────────────────────────────────────────────────────────────┤
│                    STAGE 2: LLM Judge                         │
│                    (Grounded on Stage 1 evidence)            │
│                                                              │
│  Inputs:  Stage 1 scores + history + codebook + context      │
│                                                              │
│  Prompt injects Stage 1 scores as FACTS. LLM must:          │
│    • Produce float [0.0–1.0] scores (not ordinal strings)    │
│    • Stay within ±0.15 of centroid_similarity for            │
│      consistency_score (or explicitly justify deviation)      │
│    • Anchor predicted_code_confidence to softmax P()          │
│                                                              │
│  Model: azure_deployment_fast                                │
├──────────────────────────────────────────────────────────────┤
│                    STAGE 3: Escalation Gate                   │
│                    (Only when Stage 1 ≠ Stage 2)             │
│                                                              │
│  Escalate to azure_deployment_reasoning ONLY when:           │
│    • |centroid_similarity - llm_consistency_score| > 0.25    │
│    • OR llm_overall_severity_score ≥ 0.65                    │
│    • OR entropy > 0.7 AND llm_conflict_severity < 0.3        │
│                                                              │
│  Target: <20% escalation rate (down from ~67%)               │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  ConsistencyScore   │
              │  (append-only table)│
              │  Stage1 + Stage2    │
              │  + escalation meta  │
              └─────────────────────┘
```

---

## 4. Step-by-Step Implementation

### Step 1: Expose vector_store internals

**File:** `backend/services/vector_store.py`

Add two public wrapper functions that `scoring.py` can import:

```python
def get_collection(user_id: str) -> chromadb.Collection:
    """Public access to the user's Chroma collection."""
    return _get_collection(user_id)


def embed_text(text: str) -> list[float]:
    """Public embedding function. Uses local or Azure depending on config."""
    return _embed_text(text)
```

These are thin wrappers around the existing private `_get_collection` and `_embed_text`. No logic changes.

---

### Step 2: Create scoring service

**New file:** `backend/services/scoring.py`

This is the Stage 1 engine. **Pure math, no LLM, fully reproducible.** All functions operate on embeddings already stored in ChromaDB.

```python
"""
Deterministic scoring layer — Stage 1 of the consistency pipeline.
All functions are pure math on embeddings. No LLM calls.
Produces reproducible, evaluatable numeric scores.
"""
from __future__ import annotations
import math
from typing import Optional

from services.vector_store import get_collection, embed_text


def get_code_centroid(user_id: str, code_label: str) -> list[float] | None:
    """
    Compute the mean embedding vector for all segments assigned to code_label.
    Returns None if the code has no segments in Chroma.
    
    This is the Thematic-LM approach: the centroid represents the
    "semantic centre" of a code based on observed usage patterns.
    """
    collection = get_collection(user_id)
    results = collection.get(
        where={"code": code_label},
        include=["embeddings"],
    )
    embeddings = results.get("embeddings")
    if not embeddings or len(embeddings) == 0:
        return None
    
    # Mean of all segment embeddings
    dim = len(embeddings[0])
    centroid = [0.0] * dim
    for emb in embeddings:
        for i in range(dim):
            centroid[i] += emb[i]
    for i in range(dim):
        centroid[i] /= len(embeddings)
    
    # L2-normalise so cosine sim == dot product
    norm = math.sqrt(sum(x * x for x in centroid))
    if norm > 0:
        centroid = [x / norm for x in centroid]
    
    return centroid


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return max(-1.0, min(1.0, dot / (norm_a * norm_b)))


def segment_to_centroid_similarity(
    user_id: str,
    segment_text: str,
    code_label: str,
) -> float | None:
    """
    Cosine similarity between a segment's embedding and the code centroid.
    
    Returns:
        Float in [0, 1] (practically; cosine can be [-1,1] but text is always positive).
        None if the code has no segments yet.
    
    This is the PRIMARY reproducible similarity score — the anchor for:
    - LLM grounding (Stage 2 must stay within ±0.15)
    - Escalation decisions (Stage 3)
    - Evaluation benchmarking
    """
    centroid = get_code_centroid(user_id, code_label)
    if centroid is None:
        return None
    seg_emb = embed_text(segment_text)
    return cosine_similarity(seg_emb, centroid)


def compute_codebook_distribution(
    user_id: str,
    segment_text: str,
    code_labels: list[str],
) -> dict[str, float]:
    """
    Compute raw cosine similarity between segment_text and the centroid of
    every code in code_labels.
    
    Returns:
        dict mapping code_label → raw cosine similarity.
        Codes with no segments get score 0.0.
    """
    seg_emb = embed_text(segment_text)
    scores: dict[str, float] = {}
    for label in code_labels:
        centroid = get_code_centroid(user_id, label)
        if centroid is None:
            scores[label] = 0.0
        else:
            scores[label] = cosine_similarity(seg_emb, centroid)
    return scores


def softmax_scores(
    raw_scores: dict[str, float],
    temperature: float = 1.0,
) -> dict[str, float]:
    """
    Softmax over raw cosine similarities → probability distribution.
    
    ITA-GPT approach: produces a probability distribution across the codebook.
    Sum of all probabilities = 1.0.
    
    Args:
        temperature: lower = more peaked (decisive); 1.0 = neutral
    
    Interpretation:
        - P(proposed_code) high → low conflict
        - P spread across codes → high conflict
        - Entropy of this distribution = standalone ambiguity metric
    """
    if not raw_scores:
        return {}
    labels = list(raw_scores.keys())
    vals = [raw_scores[l] / temperature for l in labels]
    max_val = max(vals)
    exp_vals = [math.exp(v - max_val) for v in vals]  # numerically stable
    total = sum(exp_vals)
    return {label: ev / total for label, ev in zip(labels, exp_vals)}


def distribution_entropy(prob_dist: dict[str, float]) -> float:
    """
    Normalised Shannon entropy of a probability distribution.
    
    Range [0, 1]:
        0 = perfectly certain (one code dominates)
        1 = maximally uncertain (uniform distribution)
    
    This is the single best scalar for "how ambiguous is this segment's 
    code assignment". High entropy = the segment could plausibly belong
    to multiple codes.
    """
    n = len(prob_dist)
    if n <= 1:
        return 0.0
    probs = [p for p in prob_dist.values() if p > 0]
    raw_entropy = -sum(p * math.log(p) for p in probs)
    max_entropy = math.log(n)
    return raw_entropy / max_entropy if max_entropy > 0 else 0.0


def conflict_score(prob_dist: dict[str, float], proposed_code: str) -> float:
    """
    Scalar conflict score in [0, 1].
    
    Formula: 1 - P(proposed_code)
    
    0.0 = no conflict (proposed code dominates the distribution)
    1.0 = maximum conflict (proposed code has near-zero probability)
    
    Simple, interpretable, directly evaluatable against human rater 
    disagreement rates.
    """
    return 1.0 - prob_dist.get(proposed_code, 0.0)


def compute_temporal_drift(
    user_id: str,
    code_label: str,
    window_recent: int = 5,
    window_old: int = 5,
) -> float | None:
    """
    LOGOS-inspired temporal drift detection.
    
    Computes the cosine distance between:
    - Centroid of the N most recent segments for this code
    - Centroid of the N oldest segments for this code
    
    Returns:
        Float in [0, 1] where:
            0.0  = no drift (old and new usage is semantically identical)
            >0.3 = meaningful drift (the researcher's interpretation is shifting)
        None if insufficient segments (need at least window_recent + window_old).
    
    The segments are ordered by their `created_at` metadata in ChromaDB.
    """
    collection = get_collection(user_id)
    results = collection.get(
        where={"code": code_label},
        include=["embeddings", "metadatas"],
    )
    
    embeddings = results.get("embeddings", [])
    metadatas = results.get("metadatas", [])
    
    if not embeddings or len(embeddings) < (window_recent + window_old):
        return None
    
    # Sort by created_at
    paired = list(zip(embeddings, metadatas))
    paired.sort(key=lambda x: x[1].get("created_at", ""))
    
    old_embs = [p[0] for p in paired[:window_old]]
    recent_embs = [p[0] for p in paired[-window_recent:]]
    
    # Compute centroids
    dim = len(old_embs[0])
    
    def _centroid(embs: list[list[float]]) -> list[float]:
        c = [0.0] * dim
        for emb in embs:
            for i in range(dim):
                c[i] += emb[i]
        for i in range(dim):
            c[i] /= len(embs)
        norm = math.sqrt(sum(x * x for x in c))
        if norm > 0:
            c = [x / norm for x in c]
        return c
    
    old_centroid = _centroid(old_embs)
    recent_centroid = _centroid(recent_embs)
    
    # Return cosine DISTANCE (1 - similarity)
    sim = cosine_similarity(old_centroid, recent_centroid)
    return 1.0 - sim


def compute_code_overlap_matrix(
    user_id: str,
    code_labels: list[str],
) -> dict[str, dict[str, float]]:
    """
    GATOS-inspired: pairwise cosine similarity between code centroids.
    
    Returns:
        Nested dict: {code_a: {code_b: similarity, ...}, ...}
    
    High values (>0.85) suggest codes may be semantically redundant
    and should be reviewed for potential merging.
    
    Only computed for codes that have segments (centroid exists).
    """
    centroids: dict[str, list[float]] = {}
    for label in code_labels:
        c = get_code_centroid(user_id, label)
        if c is not None:
            centroids[label] = c
    
    matrix: dict[str, dict[str, float]] = {}
    labels_with_data = list(centroids.keys())
    
    for i, a in enumerate(labels_with_data):
        matrix[a] = {}
        for j, b in enumerate(labels_with_data):
            if i == j:
                matrix[a][b] = 1.0
            elif j < i:
                matrix[a][b] = matrix[b][a]  # symmetric
            else:
                matrix[a][b] = cosine_similarity(centroids[a], centroids[b])
    
    return matrix
```

---

### Step 3: New database table

**File:** `backend/database.py`

Add a new `ConsistencyScore` model. This table is **append-only** — one row per segment creation. It forms the evaluation corpus.

```python
class ConsistencyScore(Base):
    """
    Append-only scoring record — one per coded segment.
    Contains both Stage 1 (deterministic) and Stage 2 (LLM) scores.
    Used for evaluation: export and compute kappa, precision/recall, drift.
    """
    __tablename__ = "consistency_scores"

    id = Column(String, primary_key=True)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=False)
    code_id = Column(String, ForeignKey("codes.id"), nullable=False)
    user_id = Column(String, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)

    # Stage 1: Deterministic (reproducible, no LLM)
    centroid_similarity = Column(Float, nullable=True)      # cosine(segment, code_centroid) [0,1]
    proposed_code_prob = Column(Float, nullable=True)        # P(proposed_code) from softmax [0,1]
    entropy = Column(Float, nullable=True)                   # normalised Shannon entropy [0,1]
    conflict_score = Column(Float, nullable=True)            # 1 - proposed_code_prob [0,1]
    temporal_drift = Column(Float, nullable=True)            # centroid drift for this code [0,1]
    codebook_distribution = Column(JSON, nullable=True)      # full {code: probability} dict

    # Stage 2: LLM-produced (grounded on Stage 1)
    llm_consistency_score = Column(Float, nullable=True)     # [0.0–1.0]
    llm_intent_score = Column(Float, nullable=True)          # [0.0–1.0]
    llm_conflict_severity = Column(Float, nullable=True)     # [0.0–1.0]
    llm_overall_severity = Column(Float, nullable=True)      # [0.0–1.0]
    llm_predicted_code = Column(String, nullable=True)       # inter-rater prediction
    llm_predicted_confidence = Column(Float, nullable=True)  # [0.0–1.0]

    # Stage 3: Escalation metadata
    was_escalated = Column(Boolean, default=False)
    escalation_reason = Column(String, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

Also add the relationship to `CodedSegment`:

```python
# In CodedSegment class:
consistency_scores = relationship("ConsistencyScore", backref="segment", cascade="all, delete-orphan")
```

Import and register the new model in `init_db()` (happens automatically via `Base.metadata.create_all`).

---

### Step 4: Restructure coding audit prompt

**File:** `backend/prompts/coding_audit_prompt.py`

**Change the function signature** to accept Stage 1 scores:

```python
def build_coding_audit_prompt(
    user_history: list[tuple[str, str]],
    code_definitions: dict[str, dict],
    new_quote: str,
    proposed_code: str,
    document_context: str = "",
    user_code_definitions: dict[str, str] | None = None,
    existing_codes_on_span: list[str] | None = None,
    # NEW Stage 1 parameters:
    centroid_similarity: float | None = None,
    codebook_prob_dist: dict[str, float] | None = None,
    entropy: float | None = None,
    temporal_drift: float | None = None,
) -> list[dict]:  # NOW RETURNS list[dict] (messages), NOT str
```

**Key prompt changes:**

1. **Return type** changes from a single format-string to a `list[dict]` with `system` and `user` messages. This enables structured prompting.

2. **Inject a "Deterministic Evidence" block** into the system message:

```
**DETERMINISTIC EMBEDDING SCORES (ground your judgment on these):**
- Semantic similarity of this segment to the "{proposed_code}" code centroid: **0.7234**
  (range 0–1; higher = more similar to past examples of this code)
- Softmax probability distribution across codebook:
    - CodeA: 0.482
    - CodeB: 0.311
    - CodeC: 0.207
  These probabilities are FACTUAL, not your opinion.
- Distribution entropy: 0.72 (range 0–1; higher = more ambiguous)
- Temporal drift for "{proposed_code}": 0.08 (range 0–1; >0.3 = meaningful drift)
```

3. **Replace all ordinal string outputs** with float `[0.0–1.0]` in the JSON schema:

```json
{
  "self_lens": {
    "is_consistent": true,
    "consistency_score": 0.78,
    "intent_alignment_score": 0.81,
    "reasoning": "...",
    "definition_match": "...",
    "drift_warning": "...",
    "alternative_codes": ["..."],
    "suggestion": "..."
  },
  "inter_rater_lens": {
    "predicted_code": "...",
    "predicted_code_confidence": 0.65,
    "is_conflict": false,
    "conflict_severity_score": 0.12,
    "reasoning": "...",
    "conflict_explanation": "..."
  },
  "overall_severity_score": 0.42,
  "overall_severity": "medium",
  "score_grounding_note": "..."
}
```

4. **Add grounding constraints** to the prompt:

```
SCORING RULES — YOU MUST FOLLOW THESE EXACTLY:

1. consistency_score: Float 0.0–1.0.
   MUST be consistent with the embedding similarity score:
     if similarity ≥ 0.75 → score should be ≥ 0.65
     if similarity ≤ 0.40 → score should be ≤ 0.45
   Deviation > ±0.15 requires explicit justification in reasoning.

2. intent_alignment_score: Float 0.0–1.0.
   How well does the quote match the INTENDED meaning of the proposed code?
   Semantic judgment, not just pattern matching. Can diverge from consistency_score.

3. predicted_code_confidence: Float 0.0–1.0.
   MUST be anchored to the softmax P() value for your predicted code as a floor.

4. conflict_severity_score: Float 0.0–1.0.
   0.0 = no conflict, 1.0 = maximum conflict.
   If is_conflict=false → this MUST be < 0.3.

5. overall_severity_score: Float 0.0–1.0.
   Computed as: max(1 - consistency_score, conflict_severity_score * 0.8)
   May adjust ±0.05 for context but MUST justify deviation.

6. overall_severity: String. MUST match overall_severity_score:
   ≥ 0.65 → "high", 0.35–0.64 → "medium", < 0.35 → "low"
```

5. **Codebook block** now includes per-code softmax probability:

```
CODEBOOK:
  • "Emotional Response" [embedding P=0.482]
    Researcher definition: "..."
    AI-inferred definition: "..."
```

---

### Step 5: Update ai_analyzer.py

**File:** `backend/services/ai_analyzer.py`

**5a. Update `_call_llm` to accept messages (list[dict]):**

Currently `_call_llm` takes a single `prompt: str` and wraps it as `[{"role": "user", "content": prompt}]`. It needs to also accept `list[dict]` for the new structured prompts.

```python
def _call_llm(
    prompt: str | list[dict],   # CHANGED: accept either format
    model: str | None = None,
    retries: int = 1,
) -> dict:
    client = _get_client()
    deployment = model or settings.azure_deployment_fast

    # Support both old (string) and new (messages list) format
    if isinstance(prompt, str):
        messages = [{"role": "user", "content": prompt}]
    else:
        messages = prompt

    for attempt in range(1 + retries):
        response = client.chat.completions.create(
            model=deployment,
            messages=messages,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        result = parse_json_response(raw)

        if result.get("definition") != PARSE_FAILED_SENTINEL:
            return result

        print(f"[LLM] Parse failure (attempt {attempt + 1})")

    return result
```

**5b. Update `run_coding_audit` signature and escalation logic:**

```python
def run_coding_audit(
    user_history: list[tuple[str, str]],
    code_definitions: dict[str, dict],
    new_quote: str,
    proposed_code: str,
    document_context: str = "",
    user_code_definitions: dict[str, str] | None = None,
    existing_codes_on_span: list[str] | None = None,
    # NEW Stage 1 parameters:
    centroid_similarity: float | None = None,
    codebook_prob_dist: dict[str, float] | None = None,
    entropy: float | None = None,
    temporal_drift: float | None = None,
) -> dict:
    messages = build_coding_audit_prompt(
        user_history=user_history,
        code_definitions=code_definitions,
        new_quote=new_quote,
        proposed_code=proposed_code,
        document_context=document_context,
        user_code_definitions=user_code_definitions,
        existing_codes_on_span=existing_codes_on_span,
        centroid_similarity=centroid_similarity,
        codebook_prob_dist=codebook_prob_dist,
        entropy=entropy,
        temporal_drift=temporal_drift,
    )

    result = _call_llm(messages)  # fast model

    # ── STAGE 3: Escalation — only when Stage 1 and Stage 2 diverge ──
    llm_severity = result.get("overall_severity_score", 0.0)
    llm_consistency = result.get("self_lens", {}).get("consistency_score", 1.0)
    llm_conflict = result.get("inter_rater_lens", {}).get("conflict_severity_score", 0.0)

    escalation_reason = None

    # Condition 1: LLM contradicts the embedding evidence
    if centroid_similarity is not None:
        divergence = abs(centroid_similarity - llm_consistency)
        if divergence > settings.stage_divergence_threshold:
            escalation_reason = f"stage_divergence={divergence:.3f}"

    # Condition 2: LLM itself says this is serious
    if llm_severity >= 0.65:
        escalation_reason = f"high_severity={llm_severity:.3f}"

    # Condition 3: Embedding says ambiguous but LLM dismisses it
    if entropy is not None and entropy > 0.7 and llm_conflict < 0.3:
        escalation_reason = f"entropy_conflict: entropy={entropy:.3f}, llm_conflict={llm_conflict:.3f}"

    was_escalated = escalation_reason is not None
    if was_escalated:
        result = _call_llm(messages, model=settings.azure_deployment_reasoning)

    # Attach escalation metadata to result
    result["_escalation"] = {
        "was_escalated": was_escalated,
        "reason": escalation_reason,
    }

    return result
```

Note: `analyze_quotes` is **unchanged** — it still takes a string prompt and uses the reasoning model.

---

### Step 6: Rewire `_run_background_agents`

**File:** `backend/routers/segments.py`

Add import:
```python
from services.scoring import (
    segment_to_centroid_similarity,
    compute_codebook_distribution,
    softmax_scores,
    distribution_entropy,
    conflict_score,
    compute_temporal_drift,
)
```

The new flow inside `_run_background_agents`, replacing the existing coding audit section. The embedding step and auto-analysis step remain the same.

```
_run_background_agents:

  WS → agents_started

  Step 1: Embed segment (UNCHANGED)
    add_segment_embedding(...)

  Step 2: STAGE 1 — Deterministic Scoring (NEW — replaces nothing, added before audit)
    WS → agent_thinking (agent="scoring")

    all_code_labels = [c.label for c in all_codes]

    centroid_sim = segment_to_centroid_similarity(user_id, text, code_label)
    raw_scores = compute_codebook_distribution(user_id, text, all_code_labels)
    prob_dist = softmax_scores(raw_scores, temperature=settings.softmax_temperature)
    ent = distribution_entropy(prob_dist)
    conf_score = conflict_score(prob_dist, code_label)
    drift = compute_temporal_drift(user_id, code_label)

    WS → deterministic_scores {
        segment_id, centroid_similarity, codebook_prob_dist, 
        entropy, conflict_score, temporal_drift
    }

  Step 3: STAGE 2 + 3 — LLM Audit (MODIFIED — now receives Stage 1 scores)
    WS → agent_thinking (agent="coding_audit")
    
    diverse = find_diverse_segments(...)
    user_history = [...]
    # Load code_definitions from AnalysisResult (UNCHANGED)

    audit_result = run_coding_audit(
        user_history=user_history,
        code_definitions=code_definitions,
        new_quote=text,
        proposed_code=code_label,
        document_context=document_context,
        user_code_definitions=user_code_definitions,
        existing_codes_on_span=existing_codes_on_span,
        centroid_similarity=centroid_sim,       # NEW
        codebook_prob_dist=prob_dist,           # NEW
        entropy=ent,                            # NEW
        temporal_drift=drift,                   # NEW
    )

    # Post-process (UNCHANGED — filter alternatives, handle co-applied)
    ...

    # Attach deterministic scores to payload
    audit_result["deterministic_scores"] = {
        "centroid_similarity": centroid_sim,
        "proposed_code_prob": prob_dist.get(code_label),
        "entropy": ent,
        "conflict_score": conf_score,
        "temporal_drift": drift,
        "codebook_prob_dist": prob_dist,
    }

    # Persist AgentAlert (UNCHANGED structure, payload now richer)
    alert = AgentAlert(...)
    db.add(alert)

    # NEW: Persist ConsistencyScore
    escalation = audit_result.get("_escalation", {})
    score_row = ConsistencyScore(
        id=str(uuid.uuid4()),
        segment_id=segment_id,
        code_id=code_id,
        user_id=user_id,
        project_id=project_id,
        # Stage 1
        centroid_similarity=centroid_sim,
        proposed_code_prob=prob_dist.get(code_label),
        entropy=ent,
        conflict_score=conf_score,
        temporal_drift=drift,
        codebook_distribution=prob_dist,
        # Stage 2
        llm_consistency_score=audit_result.get("self_lens", {}).get("consistency_score"),
        llm_intent_score=audit_result.get("self_lens", {}).get("intent_alignment_score"),
        llm_conflict_severity=audit_result.get("inter_rater_lens", {}).get("conflict_severity_score"),
        llm_overall_severity=audit_result.get("overall_severity_score"),
        llm_predicted_code=audit_result.get("inter_rater_lens", {}).get("predicted_code"),
        llm_predicted_confidence=audit_result.get("inter_rater_lens", {}).get("predicted_code_confidence"),
        # Stage 3
        was_escalated=escalation.get("was_escalated", False),
        escalation_reason=escalation.get("reason"),
    )
    db.add(score_row)
    db.commit()

    WS → coding_audit {
        ...existing fields...,
        # NEW top-level numeric fields for frontend rendering
        overall_severity_score,
        consistency_score,
        intent_alignment_score,
        conflict_severity_score,
        centroid_similarity,
        entropy,
        conflict_score,
        temporal_drift,
        was_escalated,
        data: audit_result,
    }

  Step 4: Auto-analysis (UNCHANGED)
    ...

  WS → agents_done
```

---

### Step 7: Update batch audit

**File:** `backend/routers/segments.py` — `_run_batch_audit_background`

Same pattern as Step 6: before calling `run_coding_audit` for each code's representative segment, compute Stage 1 scores and pass them through. Also persist `ConsistencyScore` rows.

Additionally, after all codes are processed, compute and send the code overlap matrix:

```python
from services.scoring import compute_code_overlap_matrix

# At end of batch audit, after the per-code loop:
overlap_matrix = compute_code_overlap_matrix(user_id, [c.label for c in all_codes])
_ws_send(user_id, {
    "type": "code_overlap_matrix",
    "data": overlap_matrix,
})
```

---

### Step 8: Update Pydantic models

**File:** `backend/models.py`

Add new models:

```python
class DeterministicScores(BaseModel):
    """Stage 1 scores — pure embedding math, fully reproducible."""
    centroid_similarity: Optional[float] = None
    proposed_code_prob: Optional[float] = None
    entropy: Optional[float] = None
    conflict_score: Optional[float] = None
    temporal_drift: Optional[float] = None
    codebook_prob_dist: Optional[dict[str, float]] = None


class ConsistencyScoreOut(BaseModel):
    """Full scoring record for evaluation export."""
    id: str
    segment_id: str
    code_id: str
    user_id: str
    project_id: str

    # Stage 1
    centroid_similarity: Optional[float] = None
    proposed_code_prob: Optional[float] = None
    entropy: Optional[float] = None
    conflict_score: Optional[float] = None
    temporal_drift: Optional[float] = None
    codebook_prob_dist: Optional[dict[str, float]] = None

    # Stage 2
    llm_consistency_score: Optional[float] = None
    llm_intent_score: Optional[float] = None
    llm_conflict_severity: Optional[float] = None
    llm_overall_severity: Optional[float] = None
    llm_predicted_code: Optional[str] = None
    llm_predicted_confidence: Optional[float] = None

    # Stage 3
    was_escalated: bool = False
    escalation_reason: Optional[str] = None

    created_at: datetime


class CodeOverlapEntry(BaseModel):
    code_a: str
    code_b: str
    similarity: float


class DriftTimelineEntry(BaseModel):
    code_label: str
    drift_score: float
    segment_count: int
    computed_at: datetime
```

---

### Step 9: New evaluation endpoints

**New file:** `backend/routers/evaluation.py`

```python
router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


@router.get("/scores", response_model=list[ConsistencyScoreOut])
def get_scores(
    project_id: str,
    code_id: str | None = None,
    limit: int = 500,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Export all ConsistencyScore rows for evaluation.
    
    Use this to:
    - Compute Cohen's kappa (compare llm_predicted_code vs. researcher's code)
    - Sweep precision/recall thresholds on overall_severity_score
    - Plot centroid_similarity vs llm_consistency_score for calibration analysis
    """
    query = db.query(ConsistencyScore).filter(
        ConsistencyScore.project_id == project_id
    )
    if code_id:
        query = query.filter(ConsistencyScore.code_id == code_id)
    
    rows = query.order_by(ConsistencyScore.created_at).offset(offset).limit(limit).all()
    return [ConsistencyScoreOut(...) for row in rows]


@router.get("/code-overlap")
def get_code_overlap(
    project_id: str,
    user_id: str = "default",
    db: Session = Depends(get_db),
):
    """GATOS-style code overlap matrix.
    
    Returns pairwise cosine similarities between code centroids.
    Pairs with similarity > 0.85 suggest potential code redundancy.
    """
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    code_labels = [c.label for c in codes]
    matrix = compute_code_overlap_matrix(user_id, code_labels)
    return {"matrix": matrix}


@router.get("/drift-timeline")
def get_drift_timeline(
    project_id: str,
    user_id: str = "default",
    db: Session = Depends(get_db),
):
    """Per-code temporal drift scores.
    
    Returns current drift score for each code in the project.
    Drift > 0.3 indicates the researcher's interpretation is shifting.
    """
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    results = []
    for code in codes:
        drift = compute_temporal_drift(user_id, code.label)
        seg_count = db.query(CodedSegment).filter(
            CodedSegment.code_id == code.id
        ).count()
        results.append({
            "code_label": code.label,
            "code_id": code.id,
            "drift_score": drift,
            "segment_count": seg_count,
        })
    return results
```

Register in `main.py`:
```python
from routers import evaluation
app.include_router(evaluation.router)
```

---

### Step 10: Update config thresholds

**File:** `backend/config.py`

Add new settings, keep backward compatibility:

```python
class Settings(BaseSettings):
    # ... existing settings ...
    
    # NEW: Multi-stage pipeline settings
    stage_divergence_threshold: float = 0.25    # max |Stage1 - Stage2| before escalation
    softmax_temperature: float = 1.0            # softmax temperature for codebook distribution
    drift_warning_threshold: float = 0.3        # temporal drift above this triggers warning
    code_overlap_warning_threshold: float = 0.85  # code-code similarity above this flags redundancy
    
    # RENAMED (old name still works via alias or keep both):
    # consistency_escalation_threshold → stage_divergence_threshold
```

The old `consistency_escalation_threshold` can be removed or kept as a deprecated alias. The new `stage_divergence_threshold` replaces its function with a fundamentally different meaning: it's the max acceptable gap between Stage 1 and Stage 2, not a raw score threshold.

---

### Step 11: Update WebSocket events

**Modified event — `coding_audit`:**

The existing `coding_audit` event gains new top-level numeric fields. The `data` blob still contains the full `audit_result` for backward compatibility.

```json
{
  "type": "coding_audit",
  "segment_id": "...",
  "segment_text": "...",
  "code_id": "...",
  "code_label": "...",
  "is_consistent": true,
  "is_conflict": false,
  "batch": false,
  "overall_severity_score": 0.42,
  "consistency_score": 0.78,
  "intent_alignment_score": 0.81,
  "conflict_severity_score": 0.12,
  "centroid_similarity": 0.73,
  "entropy": 0.34,
  "conflict_score": 0.22,
  "temporal_drift": 0.08,
  "was_escalated": false,
  "data": { "self_lens": {...}, "inter_rater_lens": {...}, ... }
}
```

**New event — `deterministic_scores`:**

Sent immediately after Stage 1 completes (before the LLM call). Allows the UI to show instant feedback.

```json
{
  "type": "deterministic_scores",
  "segment_id": "...",
  "data": {
    "centroid_similarity": 0.73,
    "proposed_code_prob": 0.48,
    "conflict_score": 0.52,
    "entropy": 0.72,
    "temporal_drift": 0.08,
    "codebook_prob_dist": {
      "Emotional Response": 0.48,
      "Coping Strategy": 0.31,
      "Social Support": 0.21
    }
  }
}
```

**New event — `code_overlap_matrix`:**

Sent at the end of a batch audit.

```json
{
  "type": "code_overlap_matrix",
  "data": {
    "Emotional Response": {"Coping Strategy": 0.72, "Social Support": 0.45},
    "Coping Strategy": {"Emotional Response": 0.72, "Social Support": 0.88},
    "Social Support": {"Emotional Response": 0.45, "Coping Strategy": 0.88}
  }
}
```

---

## 5. New Output Schema

The full LLM output schema requested by the restructured prompt:

```json
{
  "self_lens": {
    "is_consistent": true,
    "consistency_score": 0.78,
    "intent_alignment_score": 0.81,
    "reasoning": "The segment aligns well with the centroid similarity of 0.73...",
    "definition_match": "Matches the researcher's definition of...",
    "drift_warning": "",
    "alternative_codes": [],
    "suggestion": "..."
  },
  "inter_rater_lens": {
    "predicted_code": "Emotional Response",
    "predicted_code_confidence": 0.65,
    "is_conflict": false,
    "conflict_severity_score": 0.12,
    "reasoning": "The softmax distribution shows P(Emotional Response)=0.48...",
    "conflict_explanation": ""
  },
  "overall_severity_score": 0.22,
  "overall_severity": "low",
  "score_grounding_note": "Centroid sim 0.73 and softmax P=0.48 both support this assignment."
}
```

**Mapping from old → new fields:**

| Old field (string) | New field (float) | Derivation |
|---|---|---|
| `self_lens.consistency_score: "high\|medium\|low"` | `self_lens.consistency_score: 0.0–1.0` | Direct replacement |
| — | `self_lens.intent_alignment_score: 0.0–1.0` | **New** — semantic judgment |
| `inter_rater_lens.confidence: "high\|medium\|low"` | `inter_rater_lens.predicted_code_confidence: 0.0–1.0` | Renamed + numeric |
| — | `inter_rater_lens.conflict_severity_score: 0.0–1.0` | **New** — graded conflict |
| `overall_severity: "high\|medium\|low"` | `overall_severity_score: 0.0–1.0` + `overall_severity: "high\|medium\|low"` | Float is primary; string is derived for backward compat |

---

## 6. Escalation Logic (Stage 3)

**Current system** (being replaced):

```python
score_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
numeric = score_map.get(self_score, 0.5)
if severity == "high" or numeric < 0.7:
    escalate()
# Result: ~67% of segments escalate (both "medium" and "low" trigger)
```

**New system:**

```python
# Only escalate when Stage 1 evidence and Stage 2 judgment DISAGREE
divergence = abs(centroid_similarity - llm_consistency_score)
should_escalate = (
    divergence > 0.25                                  # LLM contradicts embedding evidence
    or llm_overall_severity_score >= 0.65              # LLM says genuinely serious
    or (entropy > 0.7 and llm_conflict_severity < 0.3) # Embedding=ambiguous but LLM=dismissive
)
# Target: <20% escalation rate
```

**Why this is better:**
- Escalation is now evidence-based, not ordinal-string-based
- Cheap segments (clear-cut assignments) stay on the fast model
- Only genuine disagreements or high-severity cases use the expensive model
- The escalation reason is logged for post-hoc analysis

---

## 7. Evaluation Support

With the `ConsistencyScore` table and evaluation endpoints, the system now supports:

### 7.1 Cohen's Kappa (Inter-Rater Agreement)

```
For each segment:
  Rater A (researcher) = proposed_code (from CodedSegment)
  Rater B (AI)         = llm_predicted_code (from ConsistencyScore)
  
kappa = (observed_agreement - chance_agreement) / (1 - chance_agreement)
```

Export via `GET /api/evaluation/scores?project_id=...` and compute in Python/R.

### 7.2 Precision/Recall on Flagging

```
For each segment, use overall_severity_score as the flagging signal.
Sweep threshold t from 0.0 to 1.0:
  flagged(t)  = segments where overall_severity_score ≥ t
  
Compare against gold standard (human labels of "should have been flagged"):
  precision(t) = TP(t) / (TP(t) + FP(t))
  recall(t)    = TP(t) / (TP(t) + FN(t))
  F1(t)        = harmonic_mean(precision, recall)
  
Optimal t = argmax F1(t)
```

Can also be done with `conflict_score` or `entropy` as the flagging signal (deterministic — no LLM needed).

### 7.3 Temporal Drift Analysis

```
For each code, plot drift_score over time (from ConsistencyScore.created_at).
Or use the dedicated endpoint:
  GET /api/evaluation/drift-timeline?project_id=...
```

Drift > `settings.drift_warning_threshold` (0.3) suggests the researcher's interpretation is evolving.

### 7.4 Code Redundancy Detection

```
GET /api/evaluation/code-overlap?project_id=...

Pairs where similarity > settings.code_overlap_warning_threshold (0.85) 
are candidates for merging.
```

### 7.5 Stage 1 vs Stage 2 Calibration

Plot `centroid_similarity` (x-axis) vs `llm_consistency_score` (y-axis). Perfect calibration = points on the diagonal. Systematic deviations reveal LLM bias.

---

## 8. Backward Compatibility

| Component | Impact | Mitigation |
|---|---|---|
| `AlertOut` payload shape | `payload` JSON now contains float scores instead of string scores | Frontend already treats `payload` as opaque dict; existing string fields become floats |
| `coding_audit` WS event | New fields added (`overall_severity_score`, etc.) | All new fields are additive; existing fields (`is_consistent`, `is_conflict`, `overall_severity` string) preserved |
| `build_coding_audit_prompt` return type | Changes from `str` → `list[dict]` | `_call_llm` updated to accept both formats; no other callers |
| `run_coding_audit` signature | New optional parameters added | All Stage 1 params have default `None`; calling without them works (falls back to no grounding) |
| Frontend alert rendering | Components reading `consistency_score` expect `"high"/"medium"/"low"` | Keep `overall_severity` string for backward compat; frontend migration is separate work |

---

## 9. Verification Checklist

After implementation, verify each of these:

- [ ] **Unit tests for `services/scoring.py`**: centroid computation, softmax sums to 1.0, entropy bounds `[0,1]`, conflict score identity `conflict_score({A: 1.0}, "A") == 0.0`, drift returns None with too few segments
- [ ] **Integration test**: Create 5 segments for a code, create a 6th. Verify Stage 1 scores are computed, passed to prompt, and stored in `ConsistencyScore` table.
- [ ] **Prompt regression**: Capture a real audit prompt before and after. Verify the LLM returns float scores (not strings) and they are within the grounding constraints.
- [ ] **Escalation rate**: Run batch audit. Count what % of codes trigger escalation. Target < 20%.
- [ ] **Evaluation export**: Hit `GET /api/evaluation/scores`, verify JSON contains all Stage 1 + Stage 2 columns.
- [ ] **Code overlap**: Hit `GET /api/evaluation/code-overlap`, verify symmetric matrix with 1.0 on diagonal.
- [ ] **Drift timeline**: Hit `GET /api/evaluation/drift-timeline`, verify returns per-code drift scores.
- [ ] **Backward compat**: Existing frontend still renders `coding_audit` events without crashing.
- [ ] **DB migration**: `ConsistencyScore` table is created by `init_db()` on startup; existing data is unaffected.

---

## Files Modified (Summary)

| File | Change type |
|---|---|
| `backend/services/vector_store.py` | Add 2 public wrapper functions |
| `backend/services/scoring.py` | **NEW FILE** — Stage 1 deterministic scoring engine |
| `backend/database.py` | Add `ConsistencyScore` model + relationship |
| `backend/prompts/coding_audit_prompt.py` | Full rewrite — messages format, numeric scores, grounding constraints |
| `backend/services/ai_analyzer.py` | Update `_call_llm` + `run_coding_audit` signature + escalation logic |
| `backend/routers/segments.py` | Rewire `_run_background_agents` + `_run_batch_audit_background` |
| `backend/models.py` | Add `DeterministicScores`, `ConsistencyScoreOut`, etc. |
| `backend/routers/evaluation.py` | **NEW FILE** — evaluation export endpoints |
| `backend/config.py` | Add `stage_divergence_threshold`, `softmax_temperature`, `drift_warning_threshold`, `code_overlap_warning_threshold` |
| `backend/main.py` | Register `evaluation` router |
