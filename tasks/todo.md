# Span-Aware Audit Lifecycle

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
