import { useState, useEffect, useCallback } from "react";
import { fetchICROverview, fetchICRPerCode, fetchICRAgreementMatrix } from "@/shared/api/client";
import type { ICROverview, ICRPerCodeMetric, ICRAgreementMatrix } from "@/shared/types";

export function useICRMetrics(projectId: string | null) {
  const [overview, setOverview] = useState<ICROverview | null>(null);
  const [perCode, setPerCode] = useState<ICRPerCodeMetric[] | null>(null);
  const [matrix, setMatrix] = useState<ICRAgreementMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [ov, pc, mx] = await Promise.all([
        fetchICROverview(projectId),
        fetchICRPerCode(projectId),
        fetchICRAgreementMatrix(projectId),
      ]);
      setOverview(ov);
      setPerCode(pc);
      setMatrix(mx);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ICR data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { overview, perCode, matrix, loading, error, reload: load };
}
