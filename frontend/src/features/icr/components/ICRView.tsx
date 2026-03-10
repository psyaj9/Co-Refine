import { useState } from "react";
import { useICRMetrics } from "../hooks/useICRMetrics";
import ICROverviewTab from "./ICROverviewTab";
import ICRAgreementMatrix from "./ICRAgreementMatrix";
import PerCodeTab from "./PerCodeTab";
import DisagreementsTab from "./DisagreementsTab";
import ResolutionTab from "./ResolutionTab";
import { cn } from "@/shared/lib/utils";
import { RefreshCw } from "lucide-react";

type ICRTab = "overview" | "matrix" | "per-code" | "disagreements" | "resolutions";

const TABS: { id: ICRTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "disagreements", label: "Disagreements" },
  { id: "per-code", label: "Per Code" },
  { id: "matrix", label: "Matrix" },
  { id: "resolutions", label: "Resolutions" },
];

interface ICRViewProps {
  projectId: string | null;
}

export default function ICRView({ projectId }: ICRViewProps) {
  const [tab, setTab] = useState<ICRTab>("overview");
  const { overview, perCode, matrix, loading, error, reload } = useICRMetrics(projectId);

  return (
    <div className="h-full flex flex-col bg-surface-50 dark:bg-surface-900">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b panel-border bg-white dark:bg-surface-800">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
          Inter-Coder Reliability
        </h2>
        <button
          type="button"
          aria-label="Refresh ICR data"
          onClick={reload}
          disabled={loading}
          className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 disabled:opacity-40"
        >
          <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Tab bar */}
      <div
        className="flex-shrink-0 flex border-b panel-border bg-white dark:bg-surface-800 overflow-x-auto"
        role="tablist"
        aria-label="ICR tabs"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
              tab === t.id
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {!projectId && (
          <p className="text-xs text-surface-400 p-4">No project selected.</p>
        )}
        {projectId && error && (
          <p className="text-xs text-red-500 p-4">
            {error}{" "}
            <button type="button" className="underline" onClick={reload}>
              Retry
            </button>
          </p>
        )}
        {projectId && loading && !overview && (
          <p className="text-xs text-surface-400 p-4 animate-pulse">Loading ICR data…</p>
        )}

        {tab === "overview" && overview && (
          <ICROverviewTab overview={overview} />
        )}

        {tab === "matrix" && matrix && (
          <div className="p-4">
            <ICRAgreementMatrix matrix={matrix} />
          </div>
        )}
        {tab === "matrix" && !loading && !matrix && projectId && (
          <p className="text-xs text-surface-400 p-4">No matrix data available.</p>
        )}

        {tab === "per-code" && perCode && (
          <PerCodeTab perCode={perCode} />
        )}

        {tab === "disagreements" && projectId && (
          <DisagreementsTab projectId={projectId} />
        )}

        {tab === "resolutions" && projectId && (
          <ResolutionTab projectId={projectId} />
        )}
      </div>
    </div>
  );
}
