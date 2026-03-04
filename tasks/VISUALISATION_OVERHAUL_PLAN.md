# Plan: Dynamic Visualisations Overhaul

## TL;DR

The current visualisations are static snapshots that only load on mount and display a fraction of available 
data. This plan: (1) makes all vis tabs auto-refresh via WebSocket events, (2) enriches existing charts 
with the ~12 unused ConsistencyScore metrics, (3) fixes the facet scatter to color by facet not just code, 
(4) adds proper loading/error states, and (5) migrates all raw `fetch()` calls to the shared API client.

**Key problems found:**
- `facet_updated` WS event is received but ignored (no-op `return` in useWebSocket.ts)
- `coding_audit`, `agents_done`, `batch_audit_done` events don't trigger vis refresh
- Only `llm_consistency_score` is displayed; 12+ other metrics go unused
- Facet scatter colors by *code* not by *facet* — all sub-themes within a code are the same color
- "Box plot" is stacked bars (Recharts limitation), but the stacking math is wrong — `min`, `q1`, `median`, 
  `q3` are stacked additively instead of being ranges
- No loading spinners, no error handling, no retry on fetch failure

---

## Steps

### Phase 1: Real-Time Auto-Refresh (WS Integration)

1. **Add vis refresh trigger to store** — In `frontend/src/shared/store/slices/uiSlice.ts`:
   - Add `visRefreshCounter: number` (default 0) and `triggerVisRefresh: () => void` 
     (increments counter)
   - All vis tabs will include `visRefreshCounter` in their `useEffect` dependency arrays

2. **Wire WS events to trigger refresh** — In `frontend/src/shared/hooks/useWebSocket.ts`:
   - `facet_updated` → call `triggerVisRefresh()` (currently a no-op)
   - `coding_audit` → call `triggerVisRefresh()` (new data for overview + consistency)
   - `agents_done` → call `triggerVisRefresh()` (audit complete)
   - `batch_audit_done` → call `triggerVisRefresh()` (batch complete, major data change)
   - `challenge_result` → call `triggerVisRefresh()` (scores may have changed)

3. **Update all three vis tabs** — Add `visRefreshCounter` from store to each tab's `useEffect` 
   dependency array:
   - `VisOverviewTab.tsx` — `useEffect` deps: `[projectId, visRefreshCounter]`
   - `FacetExplorerTab.tsx` — already has `[projectId, selectedVisCodeId]`, add `visRefreshCounter`
   - `ConsistencyTab.tsx` — already has `[projectId, selectedVisCodeId]`, add `visRefreshCounter`

### Phase 2: Migrate to Shared API Client

4. **Add vis API functions** to `frontend/src/shared/api/client.ts`:
   - `fetchVisOverview(projectId: string): Promise<OverviewData>`
   - `fetchVisFacets(projectId: string, codeId?: string): Promise<{ facets: FacetData[] }>`
   - `fetchVisConsistency(projectId: string, codeId?: string): Promise<ConsistencyData>`
   - `renameFacet(projectId: string, facetId: string, label: string): Promise<void>`
   - All use the existing fetch wrapper pattern from the shared client

5. **Replace raw fetch() in all 3 tabs** — Use the new typed API functions. Remove inline 
   `fetch()` calls and inline interfaces (import from shared types).

6. **Add shared vis types** to `frontend/src/shared/types/index.ts`:
   - `OverviewData`, `FacetData`, `ConsistencyData`, `BoxStats` interfaces
   - Export from the types barrel

### Phase 3: Enrich Overview Tab

7. **Backend: Expand overview endpoint** — In `backend/features/visualisations/service.py` `get_overview()`:
   - Add `avg_entropy`, `avg_conflict_score` to the KPI summary
   - Add `metrics_over_time`: time-series of ALL key metrics (not just consistency):
     `[{ date, avg_consistency, avg_entropy, avg_conflict, avg_centroid_sim }]`
   - Add `reflection_rate`: % of scores where `was_reflected = True`
   - Add `challenge_rate`: % of scores where `was_challenged = True`
   - Add `escalation_rate`: % of scores where `was_escalated = True`

8. **Frontend: Multi-metric trend chart** — In `VisOverviewTab.tsx`:
   - Replace single `LineChart` with multi-line `LineChart` showing consistency, entropy, and 
     conflict score over time (three color-coded lines with toggleable legend)
   - Add 2 more KPI cards: "Avg Entropy", "Escalation Rate %"
   - Add a small "Reflection/Challenge Activity" section showing rates as progress bars or small donut

9. **Frontend: Make KPI cards dynamic** — Add trend arrows (↑/↓/→) comparing current avg to 
   previous period avg. Use `Recharts` sparkline pattern inside each KPI card (tiny 50px-wide 
   `LineChart` with no axes showing last 10 data points).

### Phase 4: Fix & Enrich Facet Explorer

10. **Fix facet scatter coloring** — In `FacetExplorerTab.tsx`:
    - Currently groups by `code_name` → all facets of same code share a color
    - Change to group by `facet_label` (or `facet_id`) as individual scatter series
    - Each facet gets its own color from an expanded palette
    - Legend shows facet labels, not just code names
    - When a code filter is active, this shows the internal facet structure clearly

11. **Add facet segment count bar** — Below the scatter chart, add a horizontal `BarChart` showing 
    segment count per facet (already in API response but not rendered). Helps researchers see 
    facet size distribution at a glance.

12. **Add similarity distribution** — Small histogram or dot strip showing the `similarity_score` 
    distribution for each facet. Tight distributions = well-defined facets; spread = fuzzy.

13. **Backend: Add centroid stats to facet response** — In `get_facets()`:
    - Add `avg_similarity` and `min_similarity` per facet (computed from FacetAssignment scores)
    - Add `code_label` and `code_definition` for context

### Phase 5: Fix & Enrich Consistency Tab

14. **Fix box plot math** — In `ConsistencyTab.tsx` `computeBoxStats()`:
    - Current stacked bar approach is mathematically wrong — bars stack additively, so Q1 bar starts 
      at `min` value instead of 0
    - Fix: convert to range-based values: `{ base: min, iqr_lower: q1-min, iqr_mid: median-q1, iqr_upper: q3-median, whisker: max-q3 }`
    - This makes the stacked bars represent actual ranges correctly

15. **Add per-code multi-metric view** — In `ConsistencyTab.tsx`, when a code is selected:
    - Show a detailed `ComposedChart` with consistency score (line), entropy (area, inverted), 
      and conflict score (scatter dots) overlaid on the same timeline
    - This gives researchers a complete picture of how their coding quality evolved

16. **Backend: Expand consistency endpoint** — In `service.py` `get_consistency()`:
    - Add `entropy_scores`, `conflict_scores`, `centroid_similarity_scores` per code alongside 
      the existing `scores` (consistency)
    - Add `reflection_data`: `[{ date, was_reflected, initial_score, final_score }]` — shows 
      improvement from reflection over time

17. **Add reference lines for project thresholds** — The consistency tab shows a hardcoded 0.7 
    reference line. Replace with the actual `consistency_escalation_threshold` from project settings.
    - Frontend: read threshold from project settings in store
    - Pass as prop to ConsistencyTab

### Phase 6: Loading, Error & Empty States

18. **Consistent loading states** — Replace `<p>Loading…</p>` with proper skeleton loaders:
    - Create `ChartSkeleton.tsx` in `shared/ui/` — animated pulse rectangles matching chart dimensions
    - Use in all three vis tabs during data fetch

19. **Error handling** — Wrap all API calls in try/catch:
    - Show inline error message with "Retry" button on failure
    - Use `useState<"idle" | "loading" | "error" | "success">` pattern in each tab

20. **Better empty states** — Current empty states are minimal text. Enhance with:
    - Icon illustration (from Lucide)
    - Clear description of what action will populate the chart
    - Direct link/button to take that action (e.g., "Go to document to start coding" button)

---

## Verification

- [ ] Code a new segment → all 3 vis tabs auto-refresh without manual page reload
- [ ] Batch audit completes → overview updates with new KPI values and trend lines
- [ ] Facet explorer scatter shows different colors per facet within a single code
- [ ] Box plot ranges are mathematically correct (Q1–Q3 visually spans the interquartile range)
- [ ] Overview shows multi-metric trend lines (consistency, entropy, conflict)
- [ ] KPI cards show trend sparklines and directional arrows
- [ ] Consistency tab shows crossover chart when code is filtered (consistency + entropy + conflict)
- [ ] Loading skeletons appear during data fetch (not just "Loading…" text)
- [ ] API failure shows error message with retry button
- [ ] All fetch() calls use shared API client (no raw fetch() in vis components)
- [ ] All new TypeScript interfaces are in shared/types/index.ts
- [ ] No TypeScript errors
- [ ] Threshold reference line in consistency tab reflects actual project settings

---

## Decisions

- **WS refresh via counter**: Simplest approach — increment a number, all vis useEffects re-run. 
  No complex event routing needed.
- **Multi-metric trend over separate charts**: One chart with toggleable lines is more scannable 
  than 4 separate small charts. Legend toggle lets researchers focus.
- **Fix box plot with range stacking, not replace**: Recharts doesn't have native box plots. 
  The range-stacking approach is the correct workaround — just needs proper math.
- **Facet coloring by facet, not code**: The whole point of facet explorer is sub-theme discovery. 
  Coloring by code defeats this purpose. Each facet needs visual distinction.
- **Skeleton loaders over spinners**: Skeletons communicate layout and reduce perceived load time 
  (Material Design best practice).
- **Keep 3-tab structure**: Adding more tabs increases cognitive load. Forecasting (Plan 2) 
  integrates into Consistency tab, not a new tab.