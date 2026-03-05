# Co-Refine — Comprehensive Application Document

## 1. Executive Summary

**Co-Refine** is an AI-augmented qualitative coding research tool developed as a dissertation project at the University of Nottingham. It enables a solo qualitative researcher to upload textual documents, highlight text segments, assign qualitative codes, and receive real-time AI-powered self-consistency audits of their coding decisions. The system addresses a fundamental gap in qualitative research software: the absence of tools that support **intra-coder consistency** — the consistency of a single researcher with themselves over time — as opposed to traditional inter-coder reliability (ICR), which requires multiple coders and is philosophically mismatched with reflexive and interpretive research paradigms.

The system implements a novel **3-stage audit pipeline** combining deterministic embedding-based metrics with large language model (LLM) judgment, reflection, and human-in-the-loop challenge mechanisms. Supporting features include AI-inferred operational definitions, sub-theme (facet) discovery via clustering, a conversational AI research assistant, comprehensive visualisation dashboards, and a full edit audit trail. The architecture follows a client-server model with a React 19 single-page application frontend and a FastAPI backend, using SQLite for relational storage, ChromaDB for vector embeddings, and Azure OpenAI for LLM inference.

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
- Uses LLMs as a "ghost partner" that audits the researcher's own coding decisions against their own prior patterns
- Preserves the researcher's interpretive authority through a human-in-the-loop challenge mechanism where the researcher's expertise always takes precedence
- Tracks consistency longitudinally, enabling the researcher to monitor and reflect on drift in their coding over time

This approach is grounded in Wang et al.'s (2022) self-consistency principle for LLMs, Li et al.'s (2025) dual-loop reflection framework, and the ConVerTest (arXiv, 2026) approach combining self-consistency with chain-of-verification.

---

## 3. Technology Stack

### 3.1 Backend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Web framework | FastAPI (Python 3.12+) | Async-native, WebSocket support, automatic OpenAPI docs, dependency injection |
| ORM | SQLAlchemy 2.x (declarative base) | Mature, type-safe ORM with relationship cascade support |
| Database | SQLite (file-based) | Zero-configuration, sufficient for single-researcher use case |
| Vector store | ChromaDB (persistent, cosine distance) | Lightweight persistent embedding store with HNSW indexing |
| Embeddings | Local `all-MiniLM-L6-v2` via SentenceTransformer (default) or Azure OpenAI API | Local embeddings: zero API cost, runs on CPU; API embeddings: higher quality at cost |
| LLM inference | Azure OpenAI — gpt-5-mini (fast model) + gpt-5.2 (reasoning model) | Tiered inference: fast model for routine tasks, reasoning model for deep analysis and escalation |
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

**Project** — Top-level container for a qualitative research project. Stores per-project AI configuration including `enabled_perspectives` (JSON array of which audit lenses are active) and `thresholds_json` (JSON object of threshold overrides). Contains relationships to all child entities (documents, codes, segments, alerts, etc.).

**Document** — An uploaded textual document within a project. Supports three formats: plain text (`.txt`), Word documents (`.docx` with HTML preservation via Mammoth), and PDF (`.pdf` via PyPDF). Stores both `full_text` (plain text extraction) and `html_content` (formatted HTML for DOCX files). The `doc_type` field records the source format.

**Code** — A qualitative code (label) within a project's codebook. Stores the researcher-defined `label`, `definition` (optional natural-language explanation of the code's meaning), `colour` (hex colour for UI highlighting), and `created_by` (user identifier). Duplicate labels within a project are rejected with a 409 Conflict response.

**CodedSegment** — A text span within a document that has been assigned a code. Stores `start_index` and `end_index` (character offsets into the document text), `text` (the highlighted text), and foreign keys to both `Document` and `Code`. Also stores `tsne_x` and `tsne_y` coordinates computed during facet analysis for scatter plot visualisation.

### 4.2 AI Analysis Entities

**AnalysisResult** — An AI-inferred operational definition and interpretive lens for a code, synthesised from all segments coded with that code. Stores `definition` (the AI's inferred operational definition), `lens` (the AI's interpretation of the researcher's analytical perspective), and `reasoning` (the AI's chain of reasoning). One record per code, updated as the segment count grows.

**AgentAlert** — A persisted AI audit notification. The `alert_type` field is currently `"coding_audit"`. The `payload` field stores the complete audit result as a JSON object including consistency scores, severity, reasoning, alternative code suggestions, and all metadata.

**ConsistencyScore** — An **append-only time-series table** that captures the complete audit state for each segment evaluation. This is the primary data source for longitudinal consistency analysis. Each record contains:
- **Stage 1 deterministic metrics**: `centroid_similarity`, `is_pseudo_centroid`, `entropy`, `conflict_score`, `temporal_drift`, `proposed_code_prob`
- **Stage 2 LLM scores**: `llm_consistency_score`, `llm_intent_score`, `llm_severity`
- **Codebook distribution**: `codebook_distribution_json` (full softmax probability distribution across all codes)
- **Reflection metadata**: `was_reflected`, `pre_reflection_consistency`, `pre_reflection_intent`, `pre_reflection_severity` (enabling delta tracking between initial judgment and reflected judgment)
- **Escalation metadata**: `was_escalated`, `escalation_reason` (records whether the reasoning model was invoked and why)
- **Challenge metadata**: `was_challenged`, `challenge_feedback`, `pre_challenge_consistency`, `pre_challenge_intent`, `pre_challenge_severity`

**HumanFeedback** — Logs every researcher decision in response to AI output. Records `feedback_type` (challenge_reflection, accept, reject, override), `feedback_text` (the researcher's reasoning), `context_json` (the audit result that was being responded to), and `result_json` (the AI's revised result after considering feedback).

### 4.3 Supplementary Entities

**ChatMessage** — Stores messages in the conversational AI assistant. Each message has a `conversation_id` (grouping messages into conversations), `role` (`"user"` or `"assistant"`), and `content`. Supports multiple conversations per project.

**EditEvent** — A complete audit trail of every mutation in the system. Records `entity_type` (`"segment"` or `"code"`), `action` (`"created"`, `"updated"`, `"deleted"`), `entity_id`, `field_changed`, `old_value`, and `new_value`. Every code creation, update, deletion, and every segment creation and deletion generates an edit event.

**Facet** — A sub-theme cluster within a code, discovered via KMeans clustering of segment embeddings. Stores `label` (display name), `suggested_label` (AI-generated name, preserved even after user renames), `label_source` (`"auto"`, `"ai"`, or `"user"`), `centroid_json` (the cluster centroid embedding), `segment_count`, and `is_active` (old facets are deactivated when re-clustering occurs).

**FacetAssignment** — Links segments to facets with a `similarity_score` (cosine similarity to facet centroid) and `is_dominant` flag (whether this is the segment's primary facet assignment).

---

## 5. The 3-Stage Self-Consistency Audit Pipeline

This is the core novel contribution of Co-Refine. The pipeline executes as a FastAPI `BackgroundTask` whenever a researcher creates a new coded segment, ensuring the UI returns immediately while the audit runs asynchronously. Results are pushed to the frontend via WebSocket events.

### 5.1 Stage 1: Deterministic Scoring (Pure Mathematics, No LLM)

Stage 1 computes five embedding-based metrics that provide objective, reproducible measures of coding consistency. These metrics serve as factual grounding for the subsequent LLM judgment, preventing the LLM from hallucinating or ignoring empirical evidence.

#### 5.1.1 Centroid Similarity (Thematic-LM Approach)

**Concept**: Each code accumulates an embedding centroid — the mean of all segment embeddings assigned to that code. A new segment's consistency with the code is measured by its cosine similarity to this centroid.

**Algorithm**:
1. Retrieve all embeddings for the code from ChromaDB
2. Compute the L2-normalised mean embedding vector (the code centroid)
3. Compute cosine similarity between the new segment's embedding and the centroid
4. Result: a value in [0, 1] where 1.0 means the new segment is semantically identical to the average of all prior segments coded with this code

**Cold-start fallback**: When fewer than 2 segments exist for a code, the centroid cannot be meaningfully computed. In this case, the system uses the researcher's definition of the code (if provided) as a "pseudo-centroid" — embedding the definition text and computing similarity against it. This is flagged as `is_pseudo_centroid: true` so that downstream stages can apply appropriate caution. If no definition exists either, this metric is unavailable.

**Academic grounding**: Inspired by the Thematic-LM approach to measuring thematic coherence via embedding space proximity.

#### 5.1.2 Codebook Probability Distribution (ITA-GPT Approach)

**Concept**: Rather than only checking consistency with the assigned code, this metric computes the new segment's similarity to *every code* in the project's codebook, producing a probability distribution over all possible code assignments.

**Algorithm**:
1. For each code in the project, compute its centroid embedding
2. Compute cosine similarity between the new segment and each code centroid
3. Apply **softmax** with a configurable temperature parameter $T$ (default: 1.0):

$$P(\text{code}_i) = \frac{e^{\text{sim}_i / T}}{\sum_j e^{\text{sim}_j / T}}$$

4. Compute **normalised Shannon entropy** over the top-5 codes:

$$H = \frac{-\sum_{i=1}^{5} P(\text{code}_i) \log_2 P(\text{code}_i)}{\log_2 5}$$

5. Compute **conflict score** = $1 - P(\text{proposed\_code})$ — the probability mass on non-proposed codes, indicating how much the embedding distribution disagrees with the researcher's code choice

**Interpretation**:
- High entropy (close to 1.0) indicates the segment is equally similar to many codes — high uncertainty
- Low entropy (close to 0.0) indicates the segment clearly belongs to one code
- High conflict score means the codebook distribution assigns more probability to alternative codes than to the researcher's chosen code
- The softmax temperature controls distribution sharpness: lower temperature → more peaked distributions

**Academic grounding**: Inspired by the ITA-GPT approach to codebook-level probability assessment.

#### 5.1.3 Temporal Drift (LOGOS-Inspired)

**Concept**: Measures whether a code's meaning is shifting over time by comparing the centroid of early segments to the centroid of recent segments.

**Algorithm**:
1. Sort all segments for the code by `created_at` timestamp
2. Take the oldest $N$ segments and compute their centroid (default window $N = 5$)
3. Take the newest $N$ segments and compute their centroid
4. Drift = $1 - \text{cosine\_similarity}(\text{old\_centroid}, \text{recent\_centroid})$
5. Result: a value in [0, 1] where 0.0 means no drift and 1.0 means complete semantic shift

**Interpretation**: A high temporal drift value suggests the researcher's application of the code has evolved — they may be including different types of text under the same code label than they were initially. This can indicate productive conceptual development or problematic definitional erosion, and the LLM's judgment in Stage 2 helps distinguish between these.

**Academic grounding**: Inspired by the LOGOS framework for longitudinal concept drift detection in coding schemes.

#### 5.1.4 Code Overlap Matrix (GATOS-Inspired)

**Concept**: Computes pairwise cosine similarity between all code centroids in the project to identify potential code redundancy — pairs of codes whose segments are semantically near-identical.

**Algorithm**:
1. For each code with segments, compute its centroid
2. Compute pairwise cosine similarity between all code centroids
3. Pairs with similarity above the configurable threshold (default: 0.85) are flagged as potentially redundant

**Interpretation**: High overlap between two codes suggests they may be capturing the same underlying theme and could be candidates for merging. This metric is computed during batch audits and sent to the frontend for visualisation.

**Academic grounding**: Inspired by the GATOS framework for code overlap detection in qualitative coding.

#### 5.1.5 Segment Count

The number of segments currently assigned to the code, retrieved from the ChromaDB collection. This is used by downstream stages to calibrate confidence — judgments about codes with very few segments should be more conservative.

### 5.2 Stage 2: LLM Self-Consistency Judgment

Stage 2 implements a **two-pass architecture** where the LLM first makes an initial judgment, then reflects on and potentially revises that judgment with fresh evidence. This is the implementation of **Feature 6: Self-Consistency Reflection Loop**.

#### 5.2.1 Pass 1: Initial Judgment (Fast Model — gpt-5-mini)

The fast model receives a carefully constructed prompt containing:

1. **Windowed document context**: Approximately 2 sentences of surrounding text from the document, with the highlighted segment marked by `>>>` and `<<<` delimiters. This provides semantic context while managing token costs.

2. **Stage 1 deterministic scores as FACTS**: All metrics from Stage 1 are presented as empirical evidence that the LLM must ground its judgment on. The prompt explicitly states these are mathematical facts, not suggestions. Specific grounding rules enforce correlation between embedding evidence and LLM scores:
   - If centroid similarity ≥ 0.75, the consistency score must be ≥ 0.65
   - If centroid similarity ≤ 0.40, the consistency score must be ≤ 0.45
   - Any deviation greater than ±0.15 from the centroid similarity requires explicit justification

3. **Researcher's codebook** (treated as canonical): The researcher-supplied code label and definition, presented as the authoritative source of code meaning.

4. **AI-inferred definitions** (treated as supplementary): If an auto-analysis has been run, the AI's inferred operational definition and interpretive lens are included for comparison, but explicitly subordinate to the researcher's own definition.

5. **MMR-diverse coding history**: A set of prior segments coded with the same code, selected via **Maximal Marginal Relevance** (MMR) sampling to balance relevance to the current segment with diversity across the code's usage history. The MMR algorithm scores candidates as:

$$\text{MMR\_score} = \lambda \cdot \text{sim}(\text{query}, \text{candidate}) - (1 - \lambda) \cdot \max_{s \in \text{selected}} \text{sim}(\text{candidate}, s)$$

where $\lambda = 0.5$ (balanced relevance/diversity). This ensures the LLM sees a representative cross-section of how the code has been applied, not just the most similar examples.

6. **Co-applied codes constraint**: A HARD CONSTRAINT lists all codes already applied to the same text span. The LLM is instructed to **never** suggest these as alternative codes, since the researcher has already explicitly chosen to apply them.

7. **Cold-start handling**: When Stage 1 data is unavailable (e.g., first segment for a code), the prompt includes explicit instructions to be conservative in judgment.

**Output structure**: The LLM returns a structured JSON response containing:
- `self_lens.is_consistent` (boolean): Whether the coding is consistent with prior usage
- `self_lens.consistency_score` (0.0–1.0): Numerical consistency measure
- `self_lens.intent_alignment_score` (0.0–1.0): Whether the coding aligns with the code's intended meaning
- `self_lens.reasoning` (string): Natural-language explanation of the judgment
- `self_lens.definition_match` (string): How well the segment matches the code definition
- `self_lens.drift_warning` (string or null): Warning if temporal drift is detected
- `self_lens.alternative_codes` (array): Suggested alternative codes with confidence and reasoning
- `self_lens.suggestion` (string): Actionable recommendation for the researcher
- `overall_severity_score` (0.0–1.0): Calculated as $1 - \text{consistency\_score}$ (±0.05 with justification)
- `overall_severity` (string): "high" (≥0.65), "medium" (0.35–0.64), or "low" (<0.35)
- `score_grounding_note` (string): Explicit statement of how the score relates to embedding evidence

#### 5.2.2 Pass 2: Reflection (Same Fast Model)

After the initial judgment, the same fast model is immediately presented with:
1. Its own initial judgment (full JSON)
2. A **fresh MMR sample** — new diverse examples from the coding history that may differ from Pass 1
3. The Stage 1 deterministic scores again as factual grounding
4. A self-audit checklist:
   - "Did I anchor too heavily on embedding scores?"
   - "Did I miss definitional drift revealed by the fresh examples?"
   - "Did I over-flag or under-flag inconsistency?"
   - "Is my reasoning internally coherent?"

The model may revise its scores but must justify any change greater than ±0.05. Both pre-reflection and post-reflection scores are persisted in the `ConsistencyScore` table, enabling longitudinal analysis of how much reflection typically changes the outcome.

**Academic grounding**: This two-pass architecture implements Wang et al.'s (2022) self-consistency principle (independent reasoning paths improve reliability) and Li et al.'s (2025) dual-loop reflection pattern (self-correction through structured re-examination).

**Note**: Reflection is skipped during batch audits for performance efficiency.

### 5.3 Stage 3: Escalation to Reasoning Model (gpt-5.2)

After reflection, the system evaluates whether the audit requires deeper analysis. Escalation to the more capable (and more expensive) reasoning model is triggered by:

1. **Stage divergence**: When $|\text{centroid\_similarity} - \text{llm\_consistency\_score}| > 0.25$ (configurable via `stage_divergence_threshold`). This indicates the LLM's judgment significantly contradicts the embedding evidence, suggesting the case requires deeper reasoning to resolve. Pseudo-centroid scores are excluded from this check to avoid false escalations on cold-start codes.

2. **High severity**: When the LLM's severity score is ≥ 0.80, indicating a severe consistency concern that warrants review by a more capable model.

When escalation triggers, the entire audit is re-run using the reasoning model (gpt-5.2) with the same prompt structure, replacing the fast model's judgment entirely. The `ConsistencyScore` record is updated with `was_escalated: true` and the `escalation_reason`.

### 5.4 Pass 3: Human Challenge (Researcher-in-the-Loop)

If the researcher reads the reflected (and possibly escalated) audit result and **disagrees**, they can submit a challenge through the UI:

1. The researcher writes free-text feedback explaining their reasoning
2. The LLM receives the reflected judgment, the researcher's challenge, all Stage 1 evidence, and MMR-diverse examples
3. The challenge prompt includes a critical instruction: **"The researcher's expertise and reflexive voice ALWAYS takes precedence over statistical patterns."** This ensures the AI defers to domain expertise while still providing its analytical perspective.
4. The LLM re-evaluates and may revise its scores in response to the researcher's reasoning
5. Results are persisted in both the `HumanFeedback` table and the updated `ConsistencyScore` and `AgentAlert` records

This mechanism ensures the researcher retains full interpretive authority while benefiting from AI-powered consistency monitoring.

### 5.5 Pipeline Orchestration

The complete pipeline is managed by an orchestrator that:
1. Embeds the new segment and stores it in ChromaDB
2. Retrieves all necessary context (code definitions, overlapping segments for co-applied code constraints)
3. Executes Stage 1 deterministic scoring and sends results via WebSocket (`deterministic_scores` event)
4. Executes Stage 2 initial judgment, then reflection, then evaluates escalation criteria
5. Filters alternative code suggestions against co-applied codes
6. Persists the alert and consistency score to the database
7. Triggers facet analysis (KMeans clustering) for the code
8. Sends the final `coding_audit` result via WebSocket
9. Checks if auto-analysis should run for the code

Each stage is wrapped in independent error handling with structured logging. If any stage fails, subsequent stages continue where possible. The pipeline sends `agents_started` and `agents_done` WebSocket events to bracket the full execution, enabling the frontend to show progress.

### 5.6 Sibling Re-Audit

When a segment is created or deleted, **all overlapping segments on the same text span** (segments with overlapping character ranges in the same document) are re-audited. This is necessary because:
- Co-applied code constraints change when codes are added/removed from a span
- The context for consistency judgment changes with overlapping codes
- Stale audit results would show incorrect alternative code suggestions

The re-audit sends `replaces_segment_id` and `replaces_code_id` fields in WebSocket messages so the frontend can replace stale audit cards rather than duplicating them.

### 5.7 Batch Audit

The batch audit audits every code in a project at once, typically used for a periodic full-project review. For each code:
1. MMR-sampled representative segments are selected
2. Stage 1 scores are computed
3. Stage 2 LLM judgment runs (without reflection for speed)
4. Results are sent via progressive WebSocket events (`batch_audit_progress` with completion percentages)

At the end, the code overlap matrix is computed and sent via WebSocket for the Consistency visualisation.

---

## 6. Auto-Analysis: AI-Inferred Operational Definitions

When a code accumulates enough segments (configurable, default: 3), the **reasoning model** (gpt-5.2) automatically synthesises:

1. **Operational definition**: An inferred definition of what the code means based on the actual coded text segments, not just the researcher's stated definition
2. **Interpretive lens**: An analysis of why these specific segments were grouped together — what analytical perspective or interpretive framework the researcher appears to be applying
3. **Reasoning**: The AI's chain of thought explaining how it derived its conclusions

The auto-analysis prompt instructs the model to:
- Identify the latent theme connecting all coded quotes
- Infer an operational definition from coding patterns
- Compare the inferred definition with the researcher's own definition (if provided), noting any divergence, emergent sub-themes, or drift
- Explain the "Interpretive Lens" — the analytical perspective evident in the coding choices

The AI-inferred definition is treated as **supplementary** to the researcher's own definition throughout the system. In audit prompts, the researcher's definition is labelled "canonical" while the AI's is labelled "supplementary," ensuring the researcher's interpretive authority is maintained.

Auto-analysis re-triggers every time the segment count crosses the threshold multiple (e.g., at 3, 6, 9 segments), with each re-analysis incorporating the growing body of evidence.

---

## 7. Facet Discovery: Sub-Theme Clustering

Co-Refine implements **Feature 1: Facet Drift Detector**, which discovers latent sub-meanings within codes through embedding-based clustering.

### 7.1 Clustering Algorithm

1. **Prerequisite**: Minimum 4 segments required for a code before clustering activates
2. **Embedding retrieval**: All segment embeddings for the code are fetched from ChromaDB
3. **KMeans clustering** with optimal K selection:
   - K is evaluated over the range [2, 4]
   - **Silhouette score** is computed for each K value (standard sklearn implementation)
   - The K with the highest silhouette score is selected
   - This ensures the number of sub-themes is data-driven, not arbitrary
4. **Dimensionality reduction** for visualisation:
   - **t-SNE** (t-distributed Stochastic Neighbour Embedding) is used to project high-dimensional embeddings into 2D coordinates with perplexity = min(30, max(2, n-1))
   - **PCA** (Principal Component Analysis) is used as a fallback when t-SNE fails (typically with very small datasets)
5. **Facet persistence**: Cluster centroids, assignments, and similarity scores are written to the Facet and FacetAssignment tables. Old facets are deactivated (`is_active = false`) when re-clustering occurs.

### 7.2 AI-Powered Facet Labelling

After clustering, the system generates descriptive labels for each facet:
1. The 3–5 most representative segments per facet (highest similarity to facet centroid) are selected
2. These are sent to the fast model (gpt-5-mini) along with the parent code's label and definition
3. The model generates "concise 2–5 word descriptive labels" with reasoning for each facet
4. Labels are stored as `suggested_label` (AI's original) with `label_source = "ai"`
5. If the researcher renames a facet, the `suggested_label` is preserved and `label_source` changes to `"user"`, maintaining an audit trail

**Academic grounding**: Facet discovery is grounded in Braun & Clarke's (2006, 2021) concept of sub-themes, Ryan & Bernard's (2003) cutting-and-sorting technique for identifying thematic structure, and MAXQDA's sub-code mapping visualisations.

---

## 8. Conversational AI Research Assistant

Co-Refine includes a context-aware chat assistant that enables the researcher to interactively explore their coding patterns.

### 8.1 Context Building

When the researcher sends a message, the system builds a rich context including:
1. **Codebook context**: All codes with their researcher-defined and AI-inferred definitions, interpretive lenses, and segment counts
2. **Semantic search**: The top 8 coded segments most semantically similar to the researcher's message, retrieved from ChromaDB
3. **Conversation history**: The last 20 messages from the current conversation (token efficiency ceiling)

### 8.2 Streaming Architecture

The response is generated token-by-token and streamed to the frontend via WebSocket:
- `chat_stream_start` → `chat_token` (repeated) → `chat_done`
- The frontend implements optimistic UI: the user's message appears immediately, and an assistant placeholder is added that accumulates streaming tokens
- The full response is persisted as a `ChatMessage` upon completion

### 8.3 System Prompt Design

The chat assistant is prompted as a "Qualitative research assistant embedded in Co-Refine" with instructions to:
- Reference specific codes and segments from the codebook context
- Help identify patterns, spot drift, and encourage reflection
- Never fabricate data — all claims must be grounded in the provided coding context
- Support the researcher's analytical process without imposing interpretive frameworks

---

## 9. Visualisation Dashboard

Co-Refine provides three analytical visualisation tabs that auto-refresh when audit results arrive via WebSocket.

### 9.1 Overview Tab

Displays project-level aggregate metrics:

**KPI Cards**: Total segments, total codes, average consistency score, average entropy, average conflict score

**Rate Metrics**: Reflection rate (% of scored segments that went through the reflection pass), challenge rate (% that were challenged by the researcher), escalation rate (% that triggered the reasoning model)

**Multi-Metric Time Series**: A line chart showing daily averages over time for:
- Consistency score (primary metric)
- Entropy (uncertainty metric)
- Conflict score (disagreement metric)
- Centroid similarity (embedding coherence metric)

**Top Drifting Codes**: A ranked list of codes exhibiting the highest consistency variability, sorted by standard deviation of consistency scores across their segments. This helps researchers identify which codes may need definitional refinement.

### 9.2 Facet Explorer Tab

Provides interactive visualisation of the sub-theme clusters within each code:

**t-SNE Scatter Plot**: 2D scatter plot where each point is a coded segment, coloured by facet assignment. Points closer together are more semantically similar. Hovering reveals text previews and similarity scores.

**Facet Labels**: Each facet is displayed with its label, a sparkle icon indicating AI-suggested labels, and the ability to rename. After renaming, a tooltip preserves the original AI suggestion.

**Similarity Statistics**: Per-facet average and minimum similarity to centroid, helping assess cluster tightness.

**Re-suggest Labels**: Allows the researcher to request fresh AI-generated labels, useful after significant new coding has occurred.

### 9.3 Consistency Tab

Provides code-level consistency analysis:

**Box Plots**: Per-code box plots showing the distribution of consistency scores (min, Q1, median, Q3, max). A reference line at 0.7 marks the escalation threshold. Additional metric overlays available for entropy, conflict, and centroid similarity.

**Consistency Timeline**: Chronological consistency scores for either all codes or a selected code, with optional entropy and conflict overlays. This reveals trends over time — improving consistency, degrading consistency, or sudden shifts.

**Reflection Data**: Initial versus final consistency scores for reflected audits, showing how much the reflection pass typically changes the outcome. This data supports meta-analysis of the reflection mechanism's effectiveness.

**Academic grounding**: Visualisation design draws on NVivo's Cluster Analysis and Matrix Coding Query visualisations, MAXQDA's Codeline and Mixed Methods module visualisations, and ATLAS.ti's co-occurrence table. The longitudinal timeline is inspired by Hinder et al.'s (2023, 2024) approach to visualising concept drift over time.

---

## 10. Edit History and Audit Trail

Co-Refine maintains a complete, immutable audit trail of every mutation in the system through the `EditEvent` table. Every action generates a record:

- **Segment creation**: Records `entity_type="segment"`, `action="created"`, with the segment text, code label, and document reference
- **Segment deletion**: Records the deletion with full metadata of the removed segment
- **Code creation**: Records the new code's label, definition, and colour
- **Code update**: Records the specific `field_changed` (label, definition, or colour) with `old_value` and `new_value`
- **Code deletion**: Records the deleted code's full metadata

The edit history is presented in the frontend as a chronological timeline with:
- **Scope selector**: Project-wide or document-specific views
- **History Timeline**: Chronological list of events with timestamp, entity type, and action
- **Code Change Banners**: Diff-style display showing old → new values for code mutations
- **Pagination**: Supports `limit` and `offset` for large histories

This audit trail serves dual purposes: it enables the researcher to review and reflect on their analytical process, and it provides a complete provenance record for methodological transparency.

---

## 11. Real-Time Communication Architecture

Co-Refine uses WebSocket for real-time server-to-client communication. This is essential because the audit pipeline runs as a background task that can take several seconds, and results must be pushed to the frontend as they become available.

### 11.1 Connection Management

- One WebSocket connection per user, connecting to `/ws/{user_id}`
- The server maintains per-user connection sets (supporting multiple browser tabs)
- **Thread-safe send**: Background audit tasks run in separate threads outside the asyncio event loop. The WebSocket manager uses `asyncio.run_coroutine_threadsafe()` to safely send messages from background threads
- Dead connections are automatically cleaned up on send failure
- The frontend auto-reconnects with a 3-second delay on disconnection

### 11.2 Event Types (19 Types)

| Event | Direction | Purpose |
|-------|-----------|---------|
| `agents_started` | Server → Client | Audit pipeline has begun for a segment |
| `agents_done` | Server → Client | Audit pipeline complete |
| `agent_thinking` | Server → Client | A specific audit agent is currently processing |
| `agent_error` | Server → Client | An audit agent encountered an error |
| `deterministic_scores` | Server → Client | Stage 1 complete — carries all 5 metrics |
| `coding_audit` | Server → Client | Stage 2 complete — carries full audit result |
| `reflection_complete` | Server → Client | Reflection pass completed with score deltas |
| `challenge_result` | Server → Client | Researcher's challenge has been processed |
| `analysis_updated` | Server → Client | Auto-analysis completed for a code |
| `batch_audit_started` | Server → Client | Batch audit has begun |
| `batch_audit_progress` | Server → Client | Batch audit progress update (completed/total) |
| `batch_audit_done` | Server → Client | Batch audit complete |
| `code_overlap_matrix` | Server → Client | Code redundancy matrix computed |
| `facet_updated` | Server → Client | Facet clustering has been recomputed |
| `chat_stream_start` | Server → Client | Chat response generation beginning |
| `chat_token` | Server → Client | Single streaming token from chat response |
| `chat_done` | Server → Client | Chat response complete |
| `chat_error` | Server → Client | Chat generation failed |

### 11.3 Frontend State Machine

The frontend's `pushAlert` action in the audit store acts as a complex event reducer, managing a state machine that tracks the audit pipeline's progression:

- Stage 0 (idle) → `agents_started` → Stage 1 (deterministic)
- `deterministic_scores` → Stage 1 complete, transition to Stage 2
- Stage 2 progresses through substages: `initial` → `reflecting` → `reflected`
- `coding_audit` → evaluates for escalation → Stage 3 or complete
- `challenge_result` → updates in-place

The state machine also tracks `inconsistentSegmentIds` — a set of segment IDs flagged as inconsistent, used to show red highlights in the document viewer. Stale "thinking" alerts are automatically removed when concrete results arrive. Alerts are capped at 50 to prevent unbounded growth.

---

## 12. Prompt Engineering Design

Co-Refine employs 6 carefully designed prompt builders, each with specific roles, constraints, and output structures.

### 12.1 Audit Prompt (Primary Judgment)

**Role**: "Expert Qualitative Research Auditor reviewing for SELF-CONSISTENCY"

**Key design decisions**:
- Deterministic scores presented as "FACTS" — the LLM cannot contradict mathematical evidence without justification
- Strict correlation rules between embedding similarity and consistency scores, with allowed deviation bands
- Severity is formulaically derived ($severity = 1 - consistency\_score$) with only ±0.05 adjustment allowed
- Severity string thresholds are explicitly defined to prevent subjective drift
- Cold-start handling instructs conservative judgment when data is sparse
- Researcher's definition is labelled "canonical"; AI-inferred is labelled "supplementary"
- Co-applied code exclusion is a HARD CONSTRAINT to prevent nonsensical suggestions

### 12.2 Reflection Prompt (Self-Audit)

**Role**: "You are the SAME auditor in a REFLECTION pass"

**Key design decisions**:
- The model reviews its own initial output, creating a feedback loop
- Fresh MMR examples provide new evidence that may reveal blind spots in the initial judgment
- The self-audit checklist targets specific cognitive biases: anchoring, recency, over/under-flagging
- Score changes must be justified — prevents arbitrary revision
- Same scoring rules as the audit prompt maintain mathematical constraints

### 12.3 Challenge Prompt (Human Override)

**Role**: "The researcher has READ your reflected judgment and DISAGREES"

**Key design decisions**:
- Researcher's expertise is explicitly positioned as taking precedence over statistical patterns
- The LLM receives both its own judgment and the researcher's counter-argument
- Must re-evaluate with the same evidence plus the researcher's reasoning
- Same scoring constraints apply, but the LLM may substantively revise in light of expert feedback

### 12.4 Analysis Prompt (Operational Definition Inference)

**Role**: "Expert Qualitative Researcher specialising in thematic analysis and codebook development"

**Key design decisions**:
- Uses the reasoning model (gpt-5.2) for deeper analytical capability
- Handles two cases: with and without researcher-supplied definitions
- When a researcher definition exists, the AI must explicitly compare its inferred definition and note divergence
- The "Interpretive Lens" concept asks the AI to articulate what analytical perspective the researcher appears to be applying

### 12.5 Chat Prompt (Research Assistant)

**Role**: "Qualitative research assistant embedded in Co-Refine"

**Key design decisions**:
- Rich context injection (codebook + semantic search results + conversation history)
- Grounding constraint: never fabricate data, always reference specific codes/segments
- Designed to support analytical reflection, not replace it
- Token efficiency: history limited to 20 messages, segments limited to top-8 by relevance

### 12.6 Facet Label Prompt (Sub-Theme Naming)

**Role**: "Qualitative research assistant helping analyse sub-themes within a coding scheme"

**Key design decisions**:
- Concise labels (2–5 words) to maintain visual clarity in the facet explorer
- Must provide reasoning for each label, enabling the researcher to evaluate whether the AI's interpretation aligns with theirs
- JSON-only output for reliable parsing

---

## 13. Frontend User Experience

### 13.1 Three-Panel Resizable Layout

The application presents a three-panel layout using `react-resizable-panels`:

- **Left Panel** (default 14% width, collapsible): Project picker dropdown, document list with search, code list with search. Selecting a project loads its documents, codes, and settings. Selecting a document loads its segments and switches to the document viewer.

- **Centre Panel** (default 68% width): The main content area, which switches between four modes controlled by `viewMode` state:
  - **Document mode**: The annotated document viewer showing the full text with colour-coded highlights, or the upload page for new documents
  - **Dashboard mode**: The three-tab visualisation dashboard (Overview, Facet Explorer, Consistency)
  - **History mode**: The edit history timeline

- **Right Panel** (default 18% width, collapsible, only visible when a document is active): Two tabs — Alerts (showing the audit pipeline progress and results) and Chat (the conversational AI assistant)

Panels are collapsible via header buttons, and keyboard shortcuts `Ctrl+B` and `Ctrl+J` toggle the left and right panels respectively. Layout proportions are persisted in localStorage.

### 13.2 Document Viewer and Annotation System

The document viewer renders the full document text with annotated overlays for coded segments:

1. **Annotated text rendering**: The viewer uses a pure function (`buildAnnotatedText`) that takes the document's full text, all segments, and a set of flagged (inconsistent) segment IDs, and produces HTML with `<mark>` tags. Each `<mark>` has `data-start` and `data-end` attributes for click detection. Normal segments use indigo highlighting; flagged (inconsistent) segments use red highlighting with a visible border.

2. **Line numbers**: Displayed in a fixed-width column alongside the text for reference.

3. **Margin pills**: A 44px column displaying small code-coloured pills at the vertical position of each segment. These provide an at-a-glance view of coding density and can be clicked to navigate to segments.

4. **Click interaction**: Clicking on a `<mark>` element in the text identifies the matching segments and opens the `ClickedSegmentsView` in the popover, showing full segment details.

5. **Scroll-to-segment**: When `scrollToSegmentId` is set (e.g., from clicking an alert), the viewer scrolls to and highlights the corresponding `<mark>` element.

### 13.3 Text Selection and Code Application Flow

The coding workflow follows a select-then-apply pattern:

1. **Selection capture**: The `useTextSelection` hook monitors `mouseup` events on the document text. When the user highlights text, it captures the selection string, computes character offsets into the document text using a TreeWalker, trims whitespace, and stores a `TextSelection` object in the Zustand store.

2. **Highlight Popover**: A floating, draggable dialog appears near the selection position. It uses `useDraggable` for pointer-driven drag, has `role="dialog"` with `aria-modal="true"` and a keyboard focus trap. It clamps to the viewport to prevent offscreen positioning.

3. **Code selection**: The `SelectionView` within the popover shows the code picker — the researcher selects which code to apply to the highlighted text.

4. **Pending applications**: Rather than immediately applying, the code assignment is queued as a `PendingApplication`. The `PendingApplicationsBar` at the bottom of the document viewer shows all queued applications with a confirm/dismiss interface. This enables the researcher to queue multiple code applications across different text spans before committing them as a batch.

5. **Batch confirmation**: When the researcher confirms, all pending applications are sent to the backend via the `batchCreateSegments` API endpoint, each triggering the full audit pipeline as a background task.

6. **Existing segment interaction**: Clicking on an already-coded `<mark>` element opens the `ClickedSegmentsView`, showing detailed information about all segments on that span, their codes, and their audit results.

### 13.4 Audit Alerts Interface

The right panel's Alerts tab displays audit pipeline results:

- **AuditStageProgress**: A 3-stage progress bar showing the current pipeline stage (Deterministic → LLM Audit → Escalation/Reflection). Substages (initial → reflecting → reflected) are shown within Stage 2.

- **AlertCard**: Routes each alert to the appropriate card component. For `coding_audit` alerts, this includes:
  - **Segment blockquote**: The coded text
  - **Severity badge**: Colour-coded pill (high = red, medium = amber, low = green) with the severity string
  - **Reasoning summary**: Natural-language explanation of the consistency assessment
  - **MetricStrip**: Compact display of Stage 1 deterministic scores with hover tooltips explaining each metric
  - **AuditScoreTable**: Tabular display of all Stage 1 scores with their values
  - **Alternative codes**: Suggested re-codings with confidence percentages
  - **Drift warnings**: Highlighted when temporal drift is detected
  - **Action buttons**: "Apply suggested code" (re-codes the segment) or "Keep my code" (dismisses the alert)

- **ChallengeForm**: If the researcher disagrees with the audit, a textarea input allows them to write free-text feedback, which is submitted to the challenge endpoint.

- **CodingAuditDetail**: An expandable detail view showing the full audit result including reflection metadata (initial vs. reflected scores), escalation information, and score grounding notes.

### 13.5 Project Settings

The `AgentSettingsModal` provides per-project AI configuration through two tabs:

- **Perspectives Tab**: Checkboxes for which audit perspectives are active (currently only `self_consistency`). Designed for extensibility.

- **Thresholds Tab**: Sliders for all 8 configurable thresholds, each with label, description, range, and step size:
  - Minimum segments for consistency checks (default: 3)
  - Auto-analysis trigger threshold (default: 3)
  - Vector search top-K (default: 8)
  - Consistency escalation threshold (default: 0.7)
  - Stage divergence threshold (default: 0.25)
  - Softmax temperature (default: 1.0)
  - Drift warning threshold (default: 0.3)
  - Code overlap warning threshold (default: 0.85)

The `useProjectSettings` hook manages load/save/dirty tracking with optimistic updates.

---

## 14. Infrastructure Layer

### 14.1 LLM Client

The LLM client uses Azure OpenAI via the `openai.AzureOpenAI` SDK with lazy singleton initialisation. The `call_llm()` function:
- Accepts either a string prompt or a structured messages list
- Enforces `response_format={"type": "json_object"}` for all calls
- Retries on parse failure (configurable retry count)
- Routes to either the fast deployment (gpt-5-mini) or reasoning deployment (gpt-5.2) based on the `model` parameter

### 14.2 JSON Parser

A robust parser for handling LLM output quirks:
- Strips `נקוד...ground` blocks (Gemini/DeepSeek reasoning traces)
- Extracts JSON from markdown code fences
- Falls back to regex `\{...\}` extraction
- Returns a `PARSE_FAILED_SENTINEL` on complete failure rather than throwing

### 14.3 Vector Store (ChromaDB)

ChromaDB provides persistent vector storage with:
- Per-user collections (`segments_{user_id}`) using cosine distance space (`hnsw:space: cosine`)
- HNSW (Hierarchical Navigable Small World) indexing for efficient nearest-neighbour search
- Operations: upsert (add or update embeddings), query (K-nearest-neighbour search), delete, count
- Metadata per embedding: code label, document ID, text preview, creation timestamp

### 14.4 Embedding Generation

A dual-strategy embedding system:
- **Local mode** (default): Uses `all-MiniLM-L6-v2` via SentenceTransformer, running on CPU with zero API cost. Thread-safe lazy initialisation with locks.
- **API mode**: Uses Azure OpenAI's embedding API when `azure_embedding_model` is configured. Higher quality but incurs API costs.

### 14.5 Maximal Marginal Relevance (MMR) Sampling

MMR balances relevance and diversity when selecting example segments for audit prompts:

$$\text{MMR}(c) = \lambda \cdot \text{sim}(q, c) - (1 - \lambda) \cdot \max_{s \in S} \text{sim}(c, s)$$

where $q$ is the query segment, $c$ is a candidate, $S$ is the set of already-selected segments, and $\lambda = 0.5$ (balanced).

The algorithm uses greedy selection ($O(n \times k)$) — iteratively selecting the candidate with the highest MMR score. This ensures the LLM sees a diverse, representative cross-section of coding history rather than just the most similar examples.

**Academic grounding**: Carbonell & Goldstein's (1998) MMR framework.

---

## 15. Configuration System

### 15.1 Global Configuration

All configuration is managed through Pydantic BaseSettings loaded from a `.env` file:

| Setting | Default | Purpose |
|---------|---------|---------|
| `azure_api_key`, `azure_endpoint`, `azure_api_version` | "" | Azure OpenAI credentials |
| `azure_deployment_fast` | "" | Fast model deployment name |
| `azure_deployment_reasoning` | "" | Reasoning model deployment name |
| `fast_model` | "gpt-5-mini" | Model identifier for routine tasks |
| `reasoning_model` | "gpt-5.2" | Model identifier for deep analysis |
| `embedding_model` | "local" | "local" for SentenceTransformer, or Azure deployment name |
| `min_segments_for_consistency` | 3 | Minimum segments before consistency checks activate |
| `auto_analysis_threshold` | 3 | Segment count that triggers auto-definition inference |
| `vector_search_top_k` | 8 | Number of similar segments to retrieve |
| `consistency_escalation_threshold` | 0.7 | Score below which reasoning model intervenes |
| `stage_divergence_threshold` | 0.25 | |centroid_sim − llm_score| divergence triggering escalation |
| `softmax_temperature` | 1.0 | Controls sharpness of codebook probability distribution |
| `drift_warning_threshold` | 0.3 | Temporal drift above this shows warning |
| `code_overlap_warning_threshold` | 0.85 | Centroid similarity flagging code redundancy |

### 15.2 Per-Project Overrides

Individual projects can override any threshold via the `thresholds_json` column. The `get_threshold()` function returns the project-level override when present, falling back to the global default. This allows researchers to tune sensitivity per project based on the nature of their data.

---

## 16. Accessibility

Co-Refine targets WCAG AA compliance throughout:

- **Skip navigation**: A skip-nav link at the top of the page targets `#main-content`
- **Semantic HTML**: `<nav>`, `<main>`, `<aside>` landmarks with `aria-label`s
- **Focus management**: Dialog components implement focus traps; the highlight popover uses `role="dialog"` with `aria-modal="true"` and `onKeyDown` focus trap handling
- **Icon-only buttons**: All use `aria-label` with icons marked `aria-hidden="true"` via the `IconButton` component that **requires** an `aria-label` prop
- **Colour independence**: Information is never conveyed by colour alone — severity uses text labels alongside coloured badges; coded segments use border styles in addition to background colours
- **Contrast**: The `getContrastColor()` utility computes WCAG-compliant text colours using relative luminance
- **Keyboard navigation**: Toolbar supports arrow key navigation with Home/End wrapping; panels toggle via `Ctrl+B`/`Ctrl+J`
- **Testing**: Accessibility tests at three levels:
  - Unit tests with `jest-axe` for individual components
  - Dedicated `.a11y.test.tsx` files for Toolbar and StatusBar
  - End-to-end accessibility tests with Playwright + axe-core scanning for WCAG 2a/2aa/21aa violations

---

## 17. Testing Infrastructure

### 17.1 Frontend Testing

**Unit tests** (Vitest + React Testing Library): Colocated with components as `ComponentName.test.tsx`. Test behaviour, not implementation. Mock factories in `test-helpers.ts` provide `mockProject`, `mockDocument`, `mockCode`, `mockSegment`, `mockAlert`, `mockAnalysis`, `mockChatMessage`, `mockEditEvent`, and a `defaultStoreState()` that stubs all 8 Zustand slices with 30+ mocked actions.

**Accessibility tests**: Colocated `.a11y.test.tsx` files using `jest-axe` for automated WCAG violation detection.

**End-to-end tests** (Playwright): Full-page accessibility scans, skip-nav validation, keyboard navigation testing, focus trap verification.

### 17.2 Backend Testing

**Planned structure**: pytest with in-memory SQLite, mocked LLM client, and mocked ChromaDB. Test files mirror the feature structure in `backend/tests/`.

---

## 18. Architecture Principles

### 18.1 Backend: Vertical Slices + Clean Architecture

Each feature (projects, documents, codes, segments, audit, chat, visualisations, edit_history, facets, scoring) is a self-contained vertical slice with its own router, schemas, service, and repository. Layer rules are strict:

- Router → Service → Repository → Database
- Service may also call Infrastructure (LLM, Vector Store, WebSocket) and Core
- Cross-feature imports are forbidden (exception: audit → scoring, as scoring's sole consumer)
- Core and Infrastructure may never import from Features

### 18.2 Frontend: Layer Boundaries
app → widgets → features → shared

### 18.3 Non-Blocking AI Pattern

A critical architectural decision: segment creation returns immediately to the user. All AI processing (audit pipeline, auto-analysis, facet clustering) runs as FastAPI `BackgroundTask`s in separate threads. Results are pushed to the frontend via WebSocket as they become available. This ensures the coding workflow is never blocked by AI latency.

### 18.4 Tiered Inference

Two LLM tiers manage cost and capability:
- **Fast model** (gpt-5-mini): Used for routine consistency judgment, reflection, chat, facet labelling. Lower cost per token.
- **Reasoning model** (gpt-5.2): Used for escalation (high severity or stage divergence), auto-analysis (operational definition inference). Higher capability for complex analytical reasoning.

### 18.5 Local Embeddings

By default, text embeddings are computed locally using `all-MiniLM-L6-v2` via SentenceTransformer, running on CPU. This incurs zero API cost and zero network latency for embedding operations, which are the most frequent AI operation (every segment creation, every similarity query). API-based embeddings remain available as a configuration option for higher quality.

---

## 19. Complete Academic Reference List

| Reference | Domain | Usage in Co-Refine |
|-----------|--------|-------------------|
| Braun & Clarke (2006) | Qualitative methodology | Reflexive thematic analysis foundation; sub-theme concept for facet detection |
| Braun & Clarke (2019) | Qualitative methodology | Reflexive TA as an interpretive act, not a mechanical process |
| Braun & Clarke (2021) | Qualitative methodology | Updated reflexive TA guidelines; critique of ICR for reflexive approaches |
| Halpin (2024) | Coding reliability | Intra-coder consistency as the relevant measure for solo researchers |
| O'Connor & Joffe (2020) | ICR critique | Systematic critique of ICR assumptions in qualitative research |
| Small (2011) | Interpretive methodology | ICR mismatch with interpretive paradigms |
| Charmaz (2006) | Grounded theory | Memos as "owning the incomplete" — reflexive writing in analytical process |
| Ryan & Bernard (2003) | Qualitative analysis | Cutting-and-sorting for sub-theme identification; basis for facet clustering |
| Wang et al. (2022) | LLM self-consistency | Self-consistency principle: independent reasoning paths improve LLM reliability |
| Li et al. (2025) | LLM reflection | Dual-loop reflection: structured self-review improves judgment quality |
| ConVerTest (arXiv, 2026) | LLM verification | Self-consistency combined with chain-of-verification |
| Reflexis (arXiv, 2026) | AI-assisted qualitative research | In-situ reflexive memos and automated code-drift alerts |
| Hinder et al. (2023, 2024) | Concept drift | Longitudinal concept drift detection and explanation methods |
| Grossoehme (2016) | Longitudinal coding | Trajectory approaches to tracking coding changes over time |
| Wachter et al. (2017) | Explainable AI | Counterfactual explanations for algorithmic decisions |
| Guidotti et al. (2024) | Counterfactual XAI | Survey of counterfactual explanation methods |
| Cito et al. (2021) | Software engineering | Counterfactual explanations applied to code decisions |
| Karimi et al. (2021) | Algorithmic recourse | Actionable recourse through counterfactual explanations |
| Stefanovitch et al. (2023) | Graph analysis | Community detection via graph + embedding methods |
| Tandon et al. (2020) | Graph embeddings | Community detection through graph embedding techniques |
| Krishnan et al. (2024) | Topic modelling | GCD-TM for qualitative analysis of psychiatry texts |
| Carbonell & Goldstein (1998) | Information retrieval | Maximal Marginal Relevance for diverse document retrieval |
| Delve Tool (2025) | CAQDAS | Intra-coder testing as trust-building in qualitative analysis |
| Quirks (2020) | Qualitative research | Multiple coders obscuring the primary researcher's interpretive voice |
| MAXQDA, NVivo, ATLAS.ti | CAQDAS | Industry-standard CAQDAS visualisation patterns (sub-code maps, cluster analysis, matrix coding, codeline, co-occurrence tables) |

---

## 20. API Endpoint Reference

### 20.1 Projects
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/projects/` | Create a new project |
| GET | `/api/projects/` | List all projects |
| DELETE | `/api/projects/{id}` | Delete a project and all children |
| GET | `/api/projects/{id}/settings` | Get project settings (perspectives + thresholds) |
| PUT | `/api/projects/{id}/settings` | Update project settings |
| GET | `/api/projects/threshold-definitions` | Get threshold metadata for UI sliders |

### 20.2 Documents
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/documents/upload` | Upload a file (txt/docx/pdf) |
| POST | `/api/documents/paste` | Create a document from pasted text |
| GET | `/api/documents/?project_id=` | List documents in a project |
| GET | `/api/documents/{id}` | Get a single document with full text |
| DELETE | `/api/documents/{id}` | Delete a document and its segments + embeddings |

### 20.3 Codes
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/codes/` | Create a new code |
| GET | `/api/codes/?project_id=` | List codes in a project |
| PATCH | `/api/codes/{id}` | Update code label/definition/colour |
| DELETE | `/api/codes/{id}` | Delete code + cascade segments + embeddings + facets |
| GET | `/api/codes/{id}/segments?user_id=` | Get segments for a specific code |

### 20.4 Segments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/segments/` | Create a coded segment (triggers audit pipeline) |
| POST | `/api/segments/batch` | Create multiple segments at once |
| GET | `/api/segments/?document_id=&user_id=` | List segments with filters |
| GET | `/api/segments/{id}` | Get a single segment |
| DELETE | `/api/segments/{id}` | Delete segment + embedding + trigger sibling re-audit |
| GET | `/api/segments/alerts?user_id=&unread_only=` | Get audit alerts |
| PATCH | `/api/segments/alerts/{id}/read` | Mark an alert as read |

### 20.5 Audit & Analysis
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/segments/analyze` | Manually trigger analysis for a code |
| GET | `/api/segments/analyses?project_id=` | Get all AI-inferred analyses |
| POST | `/api/segments/batch-audit` | Trigger batch audit for entire project |
| POST | `/api/segments/{id}/challenge-reflection` | Submit human challenge to an audit result |

### 20.6 Chat
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/chat/` | Send a chat message (triggers streaming response) |
| GET | `/api/chat/history/{conversationId}` | Get conversation message history |
| GET | `/api/chat/conversations?project_id=&user_id=` | List conversations |
| DELETE | `/api/chat/conversations/{id}` | Delete a conversation |

### 20.7 Visualisations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects/{id}/vis/overview` | Overview KPIs + time series |
| GET | `/api/projects/{id}/vis/facets?code_id=` | Facet scatter + cluster data |
| GET | `/api/projects/{id}/vis/consistency?code_id=` | Box plots + timeline + reflection data |
| PATCH | `/api/projects/{id}/vis/facets/{facetId}/label` | Rename a facet |
| POST | `/api/projects/{id}/vis/facets/suggest-labels?code_id=` | Request AI-generated facet labels |

### 20.8 Edit History
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects/{id}/edit-history?document_id=&entity_type=&limit=&offset=` | Paginated edit history |

### 20.9 Settings & WebSocket
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/settings` | Get system settings (API key status, model names) |
| WS | `/ws/{user_id}` | WebSocket connection for real-time events |

---

## 21. State Management Architecture

The frontend uses a Zustand v5 composed store with 8 independent slices, composed via spread in the `create()` call. Cross-slice access uses `get()` for reading sibling slice state.

### 21.1 UI Slice
Manages view state: `viewMode` (document/dashboard/history), `rightPanelTab` (alerts/chat), `showUploadPage`, `selectedVisCodeId` (for filtering visualisations), `visRefreshCounter` (incremented by WebSocket events to trigger re-fetches), and search queries for codes and documents.

### 21.2 Project Slice
Manages project CRUD and the active project selection. When `setActiveProject` is called, it cascades: resets child state, then deferred-loads documents, codes, analyses, and project settings.

### 21.3 Document Slice
Manages document list and active document selection. Document deletion cascades to reload codes and analyses (because segment counts change).

### 21.4 Code Slice
Manages the codebook (codes array), active code selection, and AI-inferred analyses. Code CRUD cascades appropriately.

### 21.5 Segment Slice
Manages coded segments, the text selection state, clicked segments, pending code applications, retrieved segments (for similarity search), and scroll-to-segment targeting. The `setSelection` and `setClickedSegments` actions are mutually exclusive — setting one clears the other. The `confirmPendingApplications` action sends all queued applications to the backend via the batch API.

### 21.6 Audit Slice
The most complex slice. Manages the alert queue (capped at 50), the audit pipeline state machine (`AuditStage` with current stage and substage), batch audit lifecycle, and inconsistent segment tracking. The `pushAlert` reducer handles 15+ event types with Stage transitions, stale alert replacement, and inconsistent segment ID tracking.

### 21.7 Chat Slice
Manages chat messages with optimistic UI — user messages appear immediately, assistant responses stream token-by-token via WebSocket. Supports conversation management (load history, clear, new conversation).

### 21.8 History Slice
Manages edit history events with scope filtering (project-wide or document-specific) and auto-reload on scope change.

---

## 22. Design Tokens and Theming

The application uses a custom Tailwind CSS token system:

- **Surface tokens** (`surface-50` through `surface-900`): Neutral grays for backgrounds, borders, and text
- **Brand tokens** (`brand-50`, `brand-500`, `brand-900`): Primary blue for interactive elements and emphasis
- **Panel tokens** (`panel-border`, `panel-bg`): Consistent panel styling throughout the layout
- **Dark mode**: Supported via Tailwind's `dark:` prefix, following system preference
- **Conditional class merging**: The `cn()` utility (wrapping `twMerge` + `clsx`) enables conditional class composition throughout all components

---

## 23. Shared UI Component Library

### Badge
A pill/badge component with 7 variant presets (default, success, warning, danger, info, violet, sky), 2 sizes (xs, sm), and configurable rounding. Used for severity badges, status indicators, and code labels.

### IconButton
A `forwardRef` icon-only button with 3 variants (ghost, overlay, danger), 3 sizes, and a **mandatory** `aria-label` prop. Icons are automatically marked `aria-hidden="true"`.

### ChartSkeleton
Loading skeleton for charts and KPI cards, using `animate-pulse` and `aria-hidden="true"` for accessible loading states.

---

## 24. Mathematical Formulas Reference

### Softmax Distribution
$$P(\text{code}_i) = \frac{e^{\text{sim}_i / T}}{\sum_j e^{\text{sim}_j / T}}$$

### Normalised Shannon Entropy
$$H = \frac{-\sum_{i=1}^{k} P(\text{code}_i) \log_2 P(\text{code}_i)}{\log_2 k}$$

### Conflict Score
$$\text{conflict} = 1 - P(\text{proposed\_code})$$

### Cosine Similarity
$$\text{sim}(\mathbf{a}, \mathbf{b}) = \frac{\mathbf{a} \cdot \mathbf{b}}{||\mathbf{a}|| \cdot ||\mathbf{b}||}$$

### Temporal Drift
$$\text{drift} = 1 - \text{sim}(\text{centroid}_{\text{old}}, \text{centroid}_{\text{recent}})$$

### Maximal Marginal Relevance
$$\text{MMR}(c) = \lambda \cdot \text{sim}(q, c) - (1 - \lambda) \cdot \max_{s \in S} \text{sim}(c, s)$$

### Severity Score
$$\text{severity} = 1 - \text{consistency\_score} \quad (\pm 0.05 \text{ with justification})$$

