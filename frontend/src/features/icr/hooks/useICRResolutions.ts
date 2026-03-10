import { useState, useEffect, useCallback } from "react";
import { fetchICRResolutions, updateICRResolution } from "@/api/client";
import type { ICRResolution } from "@/types";

export function useICRResolutions(projectId: string | null) {
  const [resolutions, setResolutions] = useState<ICRResolution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchICRResolutions(projectId);
      setResolutions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resolutions");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = useCallback(async (
    resolutionId: string,
    status: "unresolved" | "resolved" | "deferred",
    note?: string
  ) => {
    if (!projectId) return;
    try {
      const updated = await updateICRResolution(projectId, resolutionId, {
        status,
        ...(note !== undefined ? { resolution_note: note } : {}),
      });
      setResolutions((prev) =>
        prev.map((r) => (r.id === resolutionId ? updated : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }, [projectId]);

  return { resolutions, loading, error, reload: load, updateStatus };
}
