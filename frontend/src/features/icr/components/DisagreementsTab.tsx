import { useState } from "react";
import { useDisagreements } from "../hooks/useDisagreements";
import DisagreementCard from "./DisagreementCard";
import { Filter } from "lucide-react";

const DISAGREEMENT_TYPES = ["all", "code_mismatch", "boundary", "coverage_gap", "split_merge"];

interface DisagreementsTabProps {
  projectId: string;
}

export default function DisagreementsTab({ projectId }: DisagreementsTabProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 15;

  const filters = {
    disagreement_type: typeFilter === "all" ? undefined : typeFilter,
    offset,
    limit: PAGE_SIZE,
  };
  const { data, loading, error, reload, analyzeDisagreement, analyzingId, analyses, resolveDisagreement } =
    useDisagreements(projectId, filters);

  function handleTypeChange(t: string) {
    setTypeFilter(t);
    setOffset(0);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b panel-border flex-shrink-0">
        <Filter size={13} className="text-surface-400" aria-hidden="true" />
        <label htmlFor="icr-type-filter" className="sr-only">Disagreement type</label>
        <select
          id="icr-type-filter"
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="text-xs rounded border panel-border bg-white dark:bg-surface-700 text-surface-700 dark:text-surface-200 px-2 py-1"
        >
          {DISAGREEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All types" : t.replace("_", " ")}
            </option>
          ))}
        </select>
        {data && (
          <span className="ml-auto text-[11px] text-surface-400">
            {data.total} disagreement{data.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <p className="text-xs text-surface-400 animate-pulse">Loading disagreements…</p>
        )}
        {error && (
          <p className="text-xs text-red-500">Failed to load disagreements. <button type="button" className="underline" onClick={reload}>Retry</button></p>
        )}
        {!loading && data && data.items.length === 0 && (
          <p className="text-xs text-surface-400">No disagreements found for current filters.</p>
        )}
        {data?.items.map((d) => (
          <DisagreementCard
            key={d.unit_id}
            disagreement={d}
            analysis={analyses[d.unit_id] ?? null}
            analyzingId={analyzingId}
            onAnalyze={analyzeDisagreement}
            onResolve={resolveDisagreement}
          />
        ))}
      </div>

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-2 border-t panel-border flex-shrink-0">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="text-xs text-brand-600 dark:text-brand-400 disabled:opacity-40 hover:underline"
          >
            ← Previous
          </button>
          <span className="text-[11px] text-surface-400">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= data.total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="text-xs text-brand-600 dark:text-brand-400 disabled:opacity-40 hover:underline"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
