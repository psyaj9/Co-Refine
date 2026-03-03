# Co-Refine: Pure Self-Consistency Coding Audit Pipeline

> **Updated technical & methodological reference**  
> **Inter-coder reliability fully removed** — now 100% focused on **intra-coder consistency** with strong human-in-the-loop collaboration.  
> Last updated: March 2026

## Why We Removed Inter-Coder Reliability (ICR)

Traditional inter-coder (or inter-rater) reliability assumes **multiple independent coders** and is primarily designed for team-based or deductive studies where external validity and reproducibility across people is required (Halpin, 2024; O’Connor & Joffe, 2020).  

In solo or small-team qualitative research — the dominant use case for tools like Co-Refine — ICR is often:

- **Not applicable** (you cannot compute agreement with yourself in real time).  
- **Philosophically mismatched** with reflexive, interpretive paradigms (Braun & Clarke, 2006, 2021; Small, 2011).  
- **Unnecessarily reductive** — it treats disagreement as error rather than productive tension.

**Intra-coder consistency** (consistency of the *same researcher* over time) is far more relevant. This includes:
- Definitional/concept drift  
- Internal coherence within a code  
- Reflexive awareness of one’s evolving interpretation  

Sources confirming this shift:
- Halpin (2024) – “Intra-Coder Reliability as consistency in an individual’s coding over time”
- Delve Tool (2025) – “Testing how consistently *you* code is a trust-building activity”
- Quirks (2020) & IAPHS (undated) – Multiple coders can actually obscure the researcher’s interpretive voice

**Result**: The entire pipeline now focuses **exclusively** on helping *one researcher* stay consistent with their own past decisions, definitions, and evolving understanding — while keeping the human firmly in control.

## Updated Pipeline Overview (Consistency-Only)

- **Stage 1** — Deterministic embedding scores (unchanged, pure math)
- **Stage 2** — LLM self-consistency judgment only (gpt-5-mini)
- **Stage 3** — Escalation to reasoning model on divergence/high severity (gpt-5.2)
- **Analysis Agent** — Now central (infers operational definitions + facets)

**All outputs are advisory.** The researcher has explicit “Accept / Edit / Override / Reject” controls at every step. Human feedback is logged and fed back into future prompts (HumanFeedback table).

## Six Novel AI-Powered Consistency Features  
(All grounded in published literature + existing codebase)

### 1. Facet Drift Detector (Intra-Code Nuance Tracking)

**What it does**  
The Analysis Agent automatically extracts 2–4 latent “facets” (sub-meanings) inside each code once segment count grows. Each new segment is scored against *facet centroids* (Stage 1 math). The LLM then flags when a segment introduces a new facet or shifts emphasis.

**Example output**  
“Emotional Distress now shows two facets: ‘immediate shock’ (old) vs. ‘ongoing relational guilt’ (new). This segment belongs 78% to the emerging facet.”

**Human-in-the-loop**  
Researcher can merge, split, rename, or ignore facets with one click. Changes instantly update centroids.

**Literature grounding**  
- Braun & Clarke (2006, 2021) – sub-themes as natural refinement within themes  
- MAXQDA & Thematic.com guides (2025–2026) – explicit splitting of themes into sub-themes for coherence  
- Cutting-and-sorting techniques for sub-theme identification (Ryan & Bernard, 2003)

**Novelty**  
First real-time, embedding-driven facet discovery tied to consistency scoring.

### 2. Reflexive Memo Co-Author Agent

**What it does**  
After every audit (or batch), the agent drafts a 3–5 sentence reflexive memo in the researcher’s voice, linking the current decision to past segments and noting any drift.

**Human-in-the-loop**  
Full inline editor + “Regenerate with my notes” + one-click save to project journal.

**Literature grounding**  
- Reflexis (arXiv 2026) – in-situ reflexive memos + code-drift alerts for provenance  
- Braun & Clarke reflexive thematic analysis (2019, 2021) – memos as core rigor practice  
- Charmaz (2006) – memos as “owning the incomplete”

**Novelty**  
Auto-generated, editable, versioned memos tied directly to consistency metrics — turns every audit into reflexive documentation.

### 3. Predictive Consistency Forecaster

**What it does**  
After ~8 segments, the reasoning model analyses the time-series of consistency_scores + temporal_drift and forecasts future drift risk (“67% chance of major drift in next 10 segments”) and flags the single past segment that would most improve consistency if re-coded.

**Human-in-the-loop**  
Slider to set personal tolerance + “mark as exception” on past segments.

**Literature grounding**  
- Hinder et al. (2023, 2024) – model-based explanations of concept drift  
- Reflexis (2026) – automated code-drift alerts for longitudinal work  
- Grossoehme (2016) – trajectory approaches to longitudinal qualitative data

**Novelty**  
Proactive forecasting instead of reactive detection — turns the system into a “consistency coach.”

### 4. Counterfactual Consistency Optimizer

**What it does**  
When consistency_score < 0.55, the LLM generates 2–3 “what-if” re-codings of the exact same text that would achieve higher consistency, plus suggested wording for the code definition.

**Human-in-the-loop**  
One-click “Apply this counterfactual” or “Here’s my better idea” (opens editor).

**Literature grounding**  
- Wachter et al. (2017) & Guidotti et al. (2024) – counterfactual explanations in XAI  
- Cito et al. (2021) – counterfactuals specifically for models of code  
- Karimi et al. (2021) – actionable recourse through counterfactuals

**Novelty**  
Counterfactuals applied to *researcher coding decisions* rather than ML predictions.

### 5. Consistency Cluster Explainer (Graph + LLM)

**What it does**  
Community detection on the embedding graph inside a single code → LLM explains the natural clusters and drift between them.

**Human-in-the-loop**  
Drag-and-drop segments between clusters, rename/merge, or override the AI’s explanation.

**Literature grounding**  
- Stefanovitch et al. (2023) – graph + embedding community detection for topic modelling  
- Tandon et al. (2020) – community detection using graph embeddings  
- Krishnan et al. (2024) – GCD-TM (graph-driven community detection for psychiatry texts)

**Novelty**  
Real-time intra-code graph clustering explained narratively by LLM.

### 6. Self-Consistency Reflection Loop (Agentic)

**What it does**  
Stage 2 becomes a 2-step loop: fast model judges → same model reflects on its own judgment + top MMR examples → final reflected score.

**Human-in-the-loop**  
After reflection appears, researcher can add “Your reflection is still off — here’s why” and trigger one more cycle.

**Literature grounding**  
- Wang et al. (2022) – Self-Consistency in LLMs  
- Li et al. (2025) – dual-loop reflection (extrospection + introspection)  
- ConVerTest (arXiv 2026) – self-consistency + chain-of-verification for code generation

**Novelty**  
Cheap, in-loop self-audit that the researcher can steer.

## Human-in-the-Loop Controls (User Always in Charge)

- Per-project “AI assistance level”: Off / Suggestions only / Full co-pilot  
- Explicit Accept/Edit/Override/Reject on every output  
- HumanFeedback table logs every decision (used to personalise future prompts)  
- Consistency Journal page (exportable) shows AI suggestion ↔ human decision side-by-side  
- Thumbs-up/down on every output → triggers meta-review by Analysis Agent after 5+ pieces of feedback  

This design guarantees **academic integrity**: the researcher remains the sole coder and final authority. The AI is a reflexive collaborator that learns the user’s unique style.

## Implementation Notes

- All features reuse existing Stage 1 scores, ChromaDB, MMR sampler, and background tasks.  
- New tables are tiny and append-only (FacetResult, MemoHistory, HumanFeedback).  
- WebSocket events extended with `human_action` and new event types.  
- Zero impact on real-time performance.

## Literature Summary (Key References)

- Braun & Clarke (2006, 2019, 2021) – reflexive thematic analysis & sub-themes  
- Halpin (2024) & O’Connor & Joffe (2020) – intra- vs inter-coder reliability  
- Reflexis (arXiv 2026) – reflexive memos + code-drift alerts  
- Hinder et al. (2023, 2024) – concept drift explanation  
- Guidotti et al. (2024) & Cito et al. (2021) – counterfactuals  
- Stefanovitch et al. (2023) & Tandon et al. (2020) – embedding graph clustering  
- Wang et al. (2022) & Li et al. (2025) – self-consistency & reflection in LLMs  

---

*This pipeline delivers rigorous, transparent, reflexive qualitative work while keeping the researcher fully in control. Perfect for supervision, methods sections, and publication.*