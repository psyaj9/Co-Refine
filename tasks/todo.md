# Implementation Progress

## Completed

- [x] **Fix numpy truthiness bug** — `backend/services/scoring.py`
  - Replaced 5 instances of `if not embeddings:` / `if embeddings and` with explicit `is None`/`len()` checks
  - Lines ~37, ~72, ~109, ~111, ~275

- [x] **Fix alerts panel layout** — `frontend/src/components/RightPanel.tsx`
  - Added `data-[state=inactive]:hidden` to both `Tabs.Content` elements
  - Root cause: `forceMount` rendered both tabs simultaneously, splitting height 50/50

- [x] **Add audit stage tracking** — `frontend/src/stores/store.ts`
  - Added `auditStage` state: `{ current: 0|1|2|3, stage1Scores, escalation, confidence }`
  - Updated `pushAlert` handlers for `agents_started`, `deterministic_scores`, `coding_audit`, `agents_done`

- [x] **Build 3-stage progress bar** — `frontend/src/components/AlertsTab.tsx`
  - Replaced 2-step spinner with segmented 3-stage progress bar (Embedding → LLM Audit → Escalation)
  - Added stage detail list with icons, confidence metrics card, escalation badge

- [x] **Enrich alert cards** — `frontend/src/lib/alert-helpers.tsx`
  - Added `alertMetrics()` function returning centroidSimilarity, entropy, conflictScore, severity, etc.
  - Added metrics strip to coding_audit alert cards

- [x] **Perspectives config backend**
  - `backend/database.py` — Added `enabled_perspectives` JSON column to Project model
  - `backend/models.py` — Added `AVAILABLE_PERSPECTIVES`, `ProjectSettingsOut`, `ProjectSettingsUpdate` models
  - `backend/routers/projects.py` — Added `GET/PUT /{project_id}/settings` endpoints
  - `backend/prompts/coding_audit_prompt.py` — Conditional prompt building based on `enabled_perspectives`
  - `backend/services/ai_analyzer.py` — Forwarded `enabled_perspectives` parameter
  - `backend/routers/segments.py` — Fetches project's `enabled_perspectives` and passes to audit pipeline

- [x] **Perspectives config frontend**
  - `frontend/src/types/index.ts` — Added `ProjectSettings` interface
  - `frontend/src/api/client.ts` — Added `fetchProjectSettings()` and `updateProjectSettings()` 
  - `frontend/src/stores/store.ts` — Added `projectSettings` state, `loadProjectSettings`, `updateProjectSettings` actions
  - `frontend/src/components/AgentSettingsModal.tsx` — New modal with toggle switches for each perspective
  - `frontend/src/components/Toolbar.tsx` — Added "Agent Settings" button

- [x] **Clear status indications** — `frontend/src/components/StatusBar.tsx`
  - Shows active perspectives (Self-Consistency / Inter-Rater icons + labels)
  - Shows current audit stage label during agent execution (Stage 1: Embedding, Stage 2: LLM Audit, Stage 3: Escalation)

## Files Modified

| File | Changes |
|------|---------|
| `backend/services/scoring.py` | Fixed 5 numpy truthiness bugs |
| `backend/database.py` | Added `enabled_perspectives` column to Project |
| `backend/models.py` | Added perspective models |
| `backend/routers/projects.py` | Added settings endpoints |
| `backend/routers/segments.py` | Wire perspectives through audit pipeline |
| `backend/services/ai_analyzer.py` | Forward `enabled_perspectives` param |
| `backend/prompts/coding_audit_prompt.py` | Conditional lens prompt sections |
| `frontend/src/types/index.ts` | Added `ProjectSettings` type |
| `frontend/src/api/client.ts` | Added settings API functions |
| `frontend/src/stores/store.ts` | Added auditStage, projectSettings state |
| `frontend/src/components/RightPanel.tsx` | Fixed tab visibility |
| `frontend/src/components/AlertsTab.tsx` | 3-stage progress bar, metrics |
| `frontend/src/components/StatusBar.tsx` | Perspectives + stage indicators |
| `frontend/src/components/Toolbar.tsx` | Agent Settings button |
| `frontend/src/components/AgentSettingsModal.tsx` | New modal component |
| `frontend/src/lib/alert-helpers.tsx` | Added `alertMetrics()` |

- [x] **Plain-language metric tooltips** — All alert metrics now show explanations on hover
  - `frontend/src/lib/constants.ts` — Added `METRIC_EXPLANATIONS` record with 15 plain-language entries
  - `frontend/src/components/MetricTooltip.tsx` — New tooltip component (hover/focus, accessible, dark mode)
  - `frontend/src/components/AlertsTab.tsx` — Wrapped Similarity, Entropy, Drift, Severity, Escalation, pseudo-centroid, sparse data with tooltips
  - `frontend/src/components/CodingAuditDetail.tsx` — Added tooltips to Self-Consistency/Inter-Rater panel headers + inline context blurbs
  - `frontend/src/lib/alert-helpers.tsx` — `alertBody()` now prepends plain-language opening line explaining WHY the alert matters; `alertTitle()` shows top predicted code for quick scanning

- [x] **Inter-rater returns up to 5 ranked codes** — Multi-code prediction
  - `backend/prompts/coding_audit_prompt.py` — Changed `predicted_code` → `predicted_codes` array (up to 5, ranked by confidence with reasoning)
  - `backend/services/ai_analyzer.py` — Normalises LLM response: sorts by confidence, backfills legacy `predicted_code` field for backward compat
  - `backend/database.py` — Added `llm_predicted_codes_json` JSON column to `ConsistencyScore` + idempotent migration
  - `backend/models.py` — Added `llm_predicted_codes_json` to `ConsistencyScoreOut`
  - `backend/routers/segments.py` — Stores predicted_codes JSON, filters out already-applied codes
  - `frontend/src/types/index.ts` — Added `PredictedCode` interface + `llm_predicted_codes_json` field
  - `frontend/src/components/CodingAuditDetail.tsx` — Ranked list UI with confidence bars, reasoning, per-candidate Apply buttons (legacy fallback preserved)
