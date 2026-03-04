# Plan: Semantic Facet Label Suggestions

## TL;DR

Facets are currently labelled "Facet 1", "Facet 2" etc with no semantic insight. This plan adds an LLM-powered 
label suggestion step after KMeans clustering — the LLM reads representative segment texts per facet and 
proposes a descriptive sub-theme name. Researchers still have full rename control (existing badge UI), but 
now start from a meaningful suggestion instead of a generic placeholder.

**Key insight**: Facets are sub-themes within a code. The segments in each cluster share a latent semantic 
thread. By sending the 3–5 most representative segments (highest `similarity_score` to centroid) per facet 
to the LLM alongside the parent code's label and definition, we get rich, contextual sub-theme labels.

---

## Steps

### Backend

1. **New prompt builder** — Create `backend/prompts/facet_label_prompt.py`
   - Input: parent code label, parent code definition (from `AnalysisResult` if exists, else code description), 
     and for each facet: 3–5 representative segment texts (highest cosine similarity to centroid from `FacetAssignment`)
   - Output schema: JSON `{ "facets": [{ "facet_index": 0, "suggested_label": "...", "reasoning": "..." }] }`
   - Prompt instructs: "You are analysing sub-themes within a qualitative code. Given these groups of text 
     segments that cluster together, suggest a concise 2–5 word descriptive label for each group that captures 
     the shared semantic theme. Explain your reasoning briefly."
   - Use the fast model (gpt-5-mini) — this is a simple summarisation task

2. **Extend facets service** — In `backend/features/facets/service.py`, add `suggest_facet_labels()` function:
   - After KMeans runs and `Facet` + `FacetAssignment` rows are created (around L94–L118)
   - For each new facet, query top-N assignments by `similarity_score DESC`, join to `CodedSegment.text`
   - Look up parent code's label + definition (from `Code` table + optional `AnalysisResult`)
   - Call LLM via `infrastructure/llm/client.py` with the facet label prompt
   - Parse JSON response; update each `Facet.label` from "Facet N" to the suggested label
   - If LLM call fails (timeout, parse error), keep "Facet N" labels — this is a graceful degradation
   - Add `suggested_by_ai: bool` column to `Facet` model so frontend can show "(AI suggested)" indicator

3. **Update Facet model** — In `backend/core/models/facet.py`:
   - Add column `suggested_label` (String, nullable) — stores the AI suggestion even after user renames
   - Add column `label_source` (String, default "auto") — values: "auto" | "ai" | "user"
   - Migration in `backend/core/models/migrations.py`: add both columns with ALTER TABLE

4. **Integrate into `run_facet_analysis()`** — In `service.py`, call `suggest_facet_labels()` after 
   facet creation and before the function returns. Keep it synchronous within the existing background thread 
   (the audit orchestrator already runs facets in a background thread at orchestrator.py L152).

5. **Update facet API response** — In `backend/features/visualisations/service.py` `get_facets()`, add 
   `label_source` and `suggested_label` to each facet dict in the response.

6. **New endpoint: Re-suggest labels** — In `backend/features/visualisations/router.py`, add:
   - `POST /api/projects/{project_id}/vis/facets/suggest-labels?code_id=X` — triggers label suggestion 
     for existing active facets of a code (for when user wants fresh suggestions)
   - Calls `suggest_facet_labels()` on existing facets, returns updated labels

### Frontend

7. **Update `FacetData` interface** — In `FacetExplorerTab.tsx`, add `label_source` and `suggested_label` 
   to the `FacetData` interface.

8. **Enhance `FacetLabelBadge`** — Show a sparkle/wand icon (from Lucide: `Sparkles` or `Wand2`) next to 
   AI-suggested labels. Tooltip: "Label suggested by AI — click to rename". When `label_source === "user"`, 
   show a small "AI suggested: {suggested_label}" tooltip so the original suggestion is always accessible.

9. **Add "Re-suggest Labels" button** — Below the facet badges, add a button 
   `"✨ Suggest labels for these facets"` that calls the new POST endpoint and refreshes the facet data. 
   Show loading spinner during the call. Disabled when no facets exist.

10. **Wire `facet_updated` WS event** — In `useWebSocket.ts`, instead of the current no-op `return`, 
    trigger a refetch of facets data. Either:
    - Call a store action that sets a `facetRefreshTrigger` counter (increment), and have `FacetExplorerTab` 
      include it in its `useEffect` dependency array
    - Or dispatch a custom event that the component listens for

11. **Migrate facet API calls to shared client** — Move the raw `fetch()` calls in `FacetExplorerTab.tsx` 
    to `shared/api/client.ts` as proper typed functions: `fetchFacets()`, `renameFacet()`, `suggestFacetLabels()`.

---

## Verification

- [ ] Create a code with 6+ segments → facets auto-generate with AI-suggested labels (not "Facet 1")
- [ ] AI label appears with sparkle icon in the badge UI
- [ ] Click badge → rename still works → `label_source` updates to "user"
- [ ] Tooltip on user-renamed badge shows original AI suggestion
- [ ] "Re-suggest labels" button triggers new suggestions and updates UI
- [ ] LLM failure gracefully falls back to "Facet N" labels
- [ ] `facet_updated` WS event now triggers UI refresh
- [ ] No TypeScript errors, no Python import errors

---

## Decisions

- **Fast model (gpt-5-mini)** for label suggestion — this is lightweight summarisation, not reasoning
- **3–5 most similar segments** per facet as input — enough for semantic signal, cheap on tokens
- **Graceful degradation** — LLM failure keeps generic labels, never blocks the pipeline
- **Store both labels** — `label` (current display) + `suggested_label` (AI's original) for auditability
- **Synchronous within background thread** — no extra thread; the facet analysis already runs in a background task