import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeFormProps {
  loading: boolean;
  error: string | null;
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Challenge textarea + submit/cancel buttons.
 * Manages its own draft text locally; delegates async submit to the parent hook.
 */
export default function ChallengeForm({ loading, error, onSubmit, onCancel }: ChallengeFormProps) {
  const [text, setText] = useState("");

  const handleSubmit = async () => {
    await onSubmit(text);
    if (!error) setText("");
  };

  return (
    <div className="rounded border border-purple-200 dark:border-purple-800 p-2 space-y-1.5">
      <p className="text-[10px] text-surface-400 dark:text-surface-500">
        Tell the AI why you disagree — it will reconsider with your feedback.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. This segment clearly shows anxiety, not just stress..."
        className="w-full text-2xs rounded border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
        rows={3}
        disabled={loading}
      />
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <div className="flex gap-1.5">
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-medium transition-colors",
            loading || !text.trim()
              ? "bg-surface-100 text-surface-400 cursor-not-allowed"
              : "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200",
          )}
        >
          {loading && <Loader2 size={9} className="animate-spin" aria-hidden="true" />}
          {loading ? "Reconsidering…" : "Submit Challenge"}
        </button>
        <button
          onClick={onCancel}
          className="rounded px-2 py-0.5 text-2xs text-surface-400 hover:text-surface-600 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Trigger button shown before the form is opened. */
export function ChallengeOpenButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-2xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
    >
      <MessageSquare size={9} aria-hidden="true" />
      Challenge this judgment
    </button>
  );
}
