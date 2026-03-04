# Plan: Predictive Consistency Forecaster

## TL;DR

After ~8 segments per code, the system analyses the time-series of stored `ConsistencyScore` records 
(centroid_similarity, entropy, temporal_drift, llm_consistency_score) and forecasts future drift risk 
using statistical trend analysis + LLM reasoning. It identifies the single past segment that would most 
improve overall consistency if re-coded. A tolerance slider lets researchers set their personal drift 
sensitivity. This turns the audit system from reactive detection into proactive "consistency coaching."

**Core idea**: ConsistencyScore is append-only with timestamps — we already have a time-series per code. 
By computing sliding-window trends (linear regression on drift metrics), detecting acceleration in drift, 
and having the reasoning model synthesise a forecast, we can warn researchers BEFORE consistency degrades.

---

## Steps

### Backend — Scoring Module

1. **New module `backend/features/scoring/forecasting.py`** — Pure statistical forecasting (no LLM):
   - `compute_drift_trajectory(scores: list[ConsistencyScore]) -> dict`:
     - Input: all ConsistencyScore rows for one code, ordered by `created_at`
     - Compute sliding-window metrics (window=3):
       - `consistency_trend`: linear regression slope on `llm_consistency_score` over time
       - `entropy_trend`: slope on `entropy`
       - `drift_acceleration`: slope on `temporal_drift` (second derivative of drift)
       - `conflict_trend`: slope on `conflict_score`
     - Return: `{ slopes: {consistency, entropy, drift, conflict}, r_squared, direction: "improving"|"stable"|"degrading", velocity: float }`
   
   - `identify_worst_segment(scores: list[ConsistencyScore], db: Session) -> dict | None`:
     - For each scored segment, compute its "drag" on the code's overall consistency:
       - `drag = (code_avg_consistency - segment_consistency) * (1 + segment_conflict_score)`
     - Return the segment with highest drag: `{ segment_id, text_preview, drag_score, current_consistency, suggested_action }`
   
   - `forecast_drift_risk(trajectory: dict, current_count: int) -> dict`:
     - Based on slopes and velocity, extrapolate next N segments:
       - If `consistency_trend < -0.02/segment` → "High risk" (P > 0.7)
       - If `entropy_trend > 0.01/segment` → "Moderate risk" (P 0.4–0.7)  
       - If drift acceleration positive → increase risk by 15%
     - Return: `{ risk_level: "low"|"moderate"|"high", probability: float, horizon_segments: int, explanation: str }`

2. **New module `backend/features/audit/forecast_handler.py`** — LLM-enhanced forecasting:
   - `generate_forecast_insight(db, user_id, code_id, project_id) -> dict`:
     - Query all `ConsistencyScore` rows for the code (min 8 required)
     - Call `compute_drift_trajectory()` and `identify_worst_segment()`
     - Call `forecast_drift_risk()`
     - If risk is "moderate" or "high", call reasoning model (gpt-5.2) with:
       - The trajectory data
       - The worst-drag segment text
       - The code definition
       - Recent 3 segment texts + their scores
     - LLM returns: narrative explanation of drift risk, specific recommendation, reformulated forecast
     - Return combined: `{ forecast: {...}, worst_segment: {...}, llm_insight: str|null, generated_at: ISO timestamp }`

3. **New prompt `backend/prompts/forecast_prompt.py`**:
   - System: "You are a qualitative coding consistency coach. Analyse drift trends and provide actionable advice."
   - User prompt includes: trend slopes, current drift value, worst segment (text + scores), code definition, 
     recent segments. Ask for: 1) plain-language forecast, 2) single most impactful recommendation, 
     3) whether the code definition should be refined.

4. **New WS event** — Add `DRIFT_FORECAST = "drift_forecast"` to `backend/core/events.py`.

5. **New API endpoint** — In `backend/features/visualisations/router.py`:
   - `GET /api/projects/{project_id}/vis/forecast?code_id=X` — returns forecast data for a specific code
   - `GET /api/projects/{project_id}/vis/forecast` — returns forecasts for all codes with 8+ scored segments
   - Response includes: risk_level, probability, worst_segment, trend data, llm_insight

6. **Threshold additions** — In `backend/features/projects/constants.py`:
   - `forecast_min_segments` (default: 8, range 5–20) — minimum scored segments before forecasting activates
   - `drift_tolerance` (default: 0.5, range 0.1–0.9) — researcher's personal tolerance; 
     scales risk probability thresholds up/down

7. **Integration with audit pipeline** — In `backend/features/audit/orchestrator.py`:
   - After Stage 2 completes (around L143), check if segment count for this code ≥ `forecast_min_segments`
   - If yes, call `generate_forecast_insight()` in the background thread
   - Send `drift_forecast` WS event with the forecast payload
   - This runs after every audit, so forecasts update continuously

8. **"Mark as exception" support** — New column on `ConsistencyScore`:
   - `is_exception: Boolean (default False)` — when True, excluded from forecast calculations
   - New endpoint: `PATCH /api/segments/{segment_id}/scores/{score_id}/exception` — toggles the flag
   - `compute_drift_trajectory()` filters out exception-marked scores

### Frontend — Forecast Display

9. **New component `ForecastCard.tsx`** in `frontend/src/features/visualisations/components/`:
   - Displays: risk level badge (green/amber/red), probability %, horizon ("next ~10 segments")
   - Worst segment: blockquote with text preview + "Re-code this segment" button (scrolls to it in document)
   - LLM insight: collapsible narrative text
   - Trend sparklines: tiny inline charts showing consistency/entropy/drift trajectories (Recharts `Sparkline` pattern — small `LineChart` with no axes)

10. **New component `ForecastTab.tsx`** or integrate into `ConsistencyTab.tsx`:
    - Option A: Add as a section above the existing box plots in ConsistencyTab
    - Option B: New 4th tab "Forecast" in the Visualisations shell
    - **Recommendation: Option A** — forecasting is about consistency, so it belongs in the Consistency tab
    - Show one `ForecastCard` per code that has enough data, sorted by risk level (highest first)

11. **Tolerance slider** — In `AgentSettingsModal.tsx` (ThresholdsTab):
    - Add `drift_tolerance` slider (0.1–0.9, default 0.5)
    - Label: "Drift Sensitivity" with explanation: "Lower = more sensitive to drift, earlier warnings"
    - Persisted via existing project thresholds system (`Project.thresholds_json`)

12. **"Mark as exception" UI** — In `CodingAuditDetail.tsx` or the forecast card:
    - Small button on the worst-segment recommendation: "Mark as intentional exception"
    - Calls the PATCH endpoint, updates local state, forecast recalculates on next audit

13. **WS event handling** — In `useWebSocket.ts`:
    - Handle `drift_forecast` event: store forecast data in a new slice or in the existing `auditSlice`
    - ConsistencyTab auto-updates when new forecast arrives

14. **Store additions** — In `auditSlice.ts` or new `forecastSlice.ts`:
    - `forecasts: Record<string, ForecastData>` — keyed by code_id
    - `setForecast(codeId, data)` action
    - `clearForecasts()` on project switch

---

## Verification

- [ ] Code with 8+ scored segments shows forecast data in Consistency tab
- [ ] Code with <8 segments shows "Not enough data for forecasting" message  
- [ ] Risk badge colors correctly: green (low), amber (moderate), red (high)
- [ ] Worst segment identified with "Re-code" button that navigates to the segment
- [ ] LLM insight appears for moderate/high risk forecasts (collapsible)
- [ ] Tolerance slider in settings affects risk thresholds
- [ ] "Mark as exception" excludes segment from future forecasts
- [ ] Forecast updates after each new audit (via WS event)
- [ ] Trend sparklines render correctly with real data
- [ ] No forecasting runs when segment count is below threshold
- [ ] LLM failure gracefully falls back to statistical-only forecast

---

## Decisions

- **Statistical first, LLM second**: Pure math forecasting always runs; LLM only for moderate/high risk 
  (saves tokens, keeps latency low)
- **Minimum 8 segments**: Enough data points for meaningful trend detection without waiting too long
- **Reasoning model (gpt-5.2)**: Forecasting requires synthesis across multiple metrics — justify the 
  heavier model for moderate/high risk only
- **Integrated into Consistency tab, not a new tab**: Keeps the UI simple, forecast is about consistency
- **Append-only `ConsistencyScore` enables this**: No schema changes needed for the time-series data — 
  it's already there. Only `is_exception` column is new.
- **"Mark as exception"**: Matches the literature on longitudinal coding — some segments are deliberately 
  different and shouldn't trigger drift warnings (Grossoehme, 2016)