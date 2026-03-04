import { useState } from "react";
import VisOverviewTab from "@/features/visualisations/components/VisOverviewTab";
import FacetExplorerTab from "@/features/visualisations/components/FacetExplorerTab";
import ConsistencyTab from "@/features/visualisations/components/ConsistencyTab";
import { cn } from "@/lib/utils";

type Tab = "overview" | "facets" | "consistency";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  facets: "Facet Explorer",
  consistency: "Consistency",
};

export default function Visualisations({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b panel-border flex-shrink-0">
        {(["overview", "facets", "consistency"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-xs font-medium transition-colors",
              activeTab === tab
                ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-200"
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "overview" && <VisOverviewTab projectId={projectId} />}
        {activeTab === "facets" && <FacetExplorerTab projectId={projectId} />}
        {activeTab === "consistency" && <ConsistencyTab projectId={projectId} />}
      </div>
    </div>
  );
}
