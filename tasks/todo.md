# Feature 6: Self-Consistency Reflection Loop

## Decisions (from planning session)

- **Reflection input**: Initial judgment + Stage 1 scores + fresh MMR sample
- **MMR strategy**: New independent MMR sample per reflection pass
- **Frontend UX**: Visible sub-stages 2a→2b within Stage 2 progress bar
- **Human challenge**: Full implementation with HumanFeedback table + new endpoint
- **Score persistence**: Both pre- and post-reflection in ConsistencyScore (new columns), show delta
- **Score logic**: Keep both scores, display delta (not replace)
- **Escalation timing**: Evaluated against reflected scores (not initial)
- **Reflection model**: Same fast model (gpt-5-mini)
- **Batch audit**: Skip reflection for speed

## Implementation Progress

- [x] Backend prompts (reflection + challenge)
- [x] Backend ai_analyzer (2-pass + challenge cycle)
- [x] Backend DB schema (new columns + HumanFeedback table)
- [x] Backend Pydantic models
- [x] Backend segments router (pipeline + challenge endpoint)
- [x] Frontend types (ReflectionMeta, ChallengeMeta, ChallengeReflectionResponse)
- [x] Frontend store (substage + reflection/challenge WS event handlers)
- [x] Frontend AlertsTab (2a→2b sub-stage progress bar with score delta)
- [x] Frontend CodingAuditDetail (reflection section + challenge button/textarea)
- [x] Frontend API client (`challengeReflection`) + constants (3 new metric explanations)
- [x] Documentation (BACKEND_AUDIT_PIPELINE.md — Stage 2b + Human Challenge sections)
- [x] Verification (0 TS errors, 20/21 test files pass — 1 pre-existing Toolbar failure)

---

# Span-Aware Audit Lifecycle (Previous)

## Completed
- [x] **Batch audit co-applied codes** — Query overlapping segments in `_run_batch_audit_background` and pass `existing_codes_on_span` (was `[]`). Added same post-processing filters as real-time path.
- [x] **`_reaudit_siblings` helper** — Shared function that re-runs Stage 2 LLM audit for all sibling segments on a span. Reuses Stage 1 scores. Sends WS messages with `replaces_segment_id`/`replaces_code_id`.
- [x] **Re-evaluate siblings on code add** — After `_run_background_agents` completes its audit, calls `_reaudit_siblings` to update sibling audit cards.
- [x] **Re-evaluate siblings on code remove** — `delete_segment` now triggers `_reaudit_siblings_background` as a background task.
- [x] **Prompt constraint hardened** — Changed co-applied section to HARD CONSTRAINT language in both the section and the instruction block.
- [x] **Frontend display-time filter** — `CodingAuditDetail` now filters `predicted_codes` and `alternative_codes` against current span state from the segments store at render time.
- [x] **Store: replace stale audit cards** — `pushAlert` detects `replaces_segment_id`/`replaces_code_id` and swaps instead of duplicating.
- [x] **Store: clean alerts on delete** — `removeSegment` now clears alerts and `inconsistentSegmentIds` for deleted segments.

## Files Changed
- `backend/routers/segments.py` — Batch fix, `_reaudit_siblings`, `_reaudit_siblings_background`, sibling re-audit on add/delete
- `backend/prompts/coding_audit_prompt.py` — Hardened co-applied constraint language
- `frontend/src/components/CodingAuditDetail.tsx` — Display-time co-applied filter
- `frontend/src/stores/store.ts` — Replace logic + stale alert cleanup
- `frontend/src/types/index.ts` — `replaces_segment_id`/`replaces_code_id` fields
