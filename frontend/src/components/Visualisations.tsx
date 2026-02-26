import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import FrequencyChart from "@/components/vis/FrequencyChart";
import CrossTabulation from "@/components/vis/CrossTabulation";
import AIAnalytics from "@/components/vis/AIAnalytics";
import ScarfPlot from "@/components/vis/ScarfPlot";
import AgreementScarfPlot from "@/components/vis/AgreementScarfPlot";
import ConflictScatter from "@/components/vis/ConflictScatter";
import CooccurrenceMatrix from "@/components/vis/CooccurrenceMatrix";
import AssignmentHistogram from "@/components/vis/AssignmentHistogram";

type VisTabId =
  | "frequencies"
  | "crosstab"
  | "analytics"
  | "scarf"
  | "agreement"
  | "scatter"
  | "cooccurrence"
  | "histogram";

const TAB_META: { id: VisTabId; label: string; group: "overview" | "ai" }[] = [
  { id: "frequencies", label: "Frequencies", group: "overview" },
  { id: "scarf", label: "Scarf Plot", group: "overview" },
  { id: "histogram", label: "Histogram", group: "overview" },
  { id: "crosstab", label: "Code × Doc", group: "overview" },
  { id: "cooccurrence", label: "Co-occurrence", group: "overview" },
  { id: "analytics", label: "AI Analytics", group: "ai" },
  { id: "agreement", label: "Agreement", group: "ai" },
  { id: "scatter", label: "Conflict", group: "ai" },
];

export default function Visualisations() {
  const [visTab, setVisTab] = useState<VisTabId>("frequencies");

  return (
    <Tabs.Root
      value={visTab}
      onValueChange={(v) => setVisTab(v as VisTabId)}
      className="flex flex-col h-full panel-bg overflow-hidden"
    >
      <Tabs.List
        className="flex border-b panel-border flex-shrink-0 px-2 gap-0.5 overflow-x-auto"
        aria-label="Visualisation tabs"
      >
        {TAB_META.map(({ id, label, group }, i) => {
          const prevGroup = i > 0 ? TAB_META[i - 1].group : group;
          return (
            <span key={id} className="flex items-center">
              {group !== prevGroup && (
                <span className="mx-1.5 h-4 w-px bg-surface-200 dark:bg-surface-700" />
              )}
              <Tabs.Trigger
                value={id}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  "data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400",
                  "data-[state=active]:border-b-2 data-[state=active]:border-brand-500",
                  "data-[state=inactive]:text-surface-400 dark:data-[state=inactive]:text-surface-500",
                  "hover:text-surface-600 dark:hover:text-surface-300"
                )}
              >
                {label}
              </Tabs.Trigger>
            </span>
          );
        })}
      </Tabs.List>

      <Tabs.Content value="frequencies" className="flex-1 overflow-hidden">
        <FrequencyChart />
      </Tabs.Content>

      <Tabs.Content value="scarf" className="flex-1 overflow-hidden">
        <ScarfPlot />
      </Tabs.Content>

      <Tabs.Content value="histogram" className="flex-1 overflow-hidden">
        <AssignmentHistogram />
      </Tabs.Content>

      <Tabs.Content value="crosstab" className="flex-1 overflow-hidden">
        <CrossTabulation />
      </Tabs.Content>

      <Tabs.Content value="cooccurrence" className="flex-1 overflow-hidden">
        <CooccurrenceMatrix />
      </Tabs.Content>

      <Tabs.Content value="analytics" className="flex-1 overflow-hidden">
        <AIAnalytics />
      </Tabs.Content>

      <Tabs.Content value="agreement" className="flex-1 overflow-hidden">
        <AgreementScarfPlot />
      </Tabs.Content>

      <Tabs.Content value="scatter" className="flex-1 overflow-hidden">
        <ConflictScatter />
      </Tabs.Content>
    </Tabs.Root>
  );
}
