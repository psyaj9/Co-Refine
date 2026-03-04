import { useState, useCallback } from "react";
import { challengeReflection } from "@/api/client";
import type { AlertPayload } from "@/types";

interface UseChallengeSubmitOptions {
  alert: AlertPayload;
  currentUser: string;
  pushAlert: (a: AlertPayload) => void;
  onSuccess: () => void;
}

interface UseChallengeSubmitResult {
  loading: boolean;
  error: string | null;
  submit: (text: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Encapsulates the async challenge API call, loading state, and error state.
 * On success it dispatches a `challenge_result` alert and calls `onSuccess`.
 */
export function useChallengeSubmit({
  alert,
  currentUser,
  pushAlert,
  onSuccess,
}: UseChallengeSubmitOptions): UseChallengeSubmitResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (text: string) => {
      if (!alert.segment_id || !text.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const resp = await challengeReflection(alert.segment_id, text.trim(), currentUser);
        pushAlert({
          type: "challenge_result",
          segment_id: alert.segment_id,
          code_id: alert.code_id,
          data: resp.audit_result,
        });
        onSuccess();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Challenge failed");
      } finally {
        setLoading(false);
      }
    },
    [alert.segment_id, alert.code_id, currentUser, pushAlert, onSuccess],
  );

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, submit, clearError };
}
