import { useState, useEffect, useCallback } from "react";
import {
  fetchICRDisagreements,
  analyzeICRDisagreement,
  createICRResolution,
} from "@/api/client";
import type { ICRDisagreement, ICRDisagreementList } from "@/types";

interface DisagreementFilters {
  document_id?: string;
  code_id?: string;
  disagreement_type?: string;
  offset?: number;
  limit?: number;
}

export function useDisagreements(projectId: string | null, filters: DisagreementFilters = {}) {
  const [data, setData] = useState<ICRDisagreementList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, string>>({});

  const filtersKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchICRDisagreements(projectId, filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disagreements");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filtersKey]);

  useEffect(() => {
    load();
  }, [load]);

  const analyzeDisagreement = useCallback(async (d: ICRDisagreement) => {
    if (!projectId) return;
    setAnalyzingId(d.unit_id);
    try {
      const result = await analyzeICRDisagreement(projectId, d.unit_id, d.document_id);
      setAnalyses((prev) => ({ ...prev, [d.unit_id]: result.analysis }));
    } catch (err) {
      setAnalyses((prev) => ({
        ...prev,
        [d.unit_id]: err instanceof Error ? err.message : "Analysis failed",
      }));
    } finally {
      setAnalyzingId(null);
    }
  }, [projectId]);

  const resolveDisagreement = useCallback(async (
    d: ICRDisagreement,
    note: string,
    chosenSegmentId?: string | null
  ) => {
    if (!projectId) return;
    try {
      await createICRResolution(projectId, {
        unit_id: d.unit_id,
        document_id: d.document_id,
        span_start: d.span_start,
        span_end: d.span_end,
        disagreement_type: d.disagreement_type,
        chosen_segment_id: chosenSegmentId ?? null,
        resolution_note: note,
      });
      await load();
    } catch {
      // swallow for now; parent handles
    }
  }, [projectId, load]);

  return { data, loading, error, reload: load, analyzeDisagreement, analyzingId, analyses, resolveDisagreement };
}
