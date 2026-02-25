import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import FrequencyChart from "@/components/vis/FrequencyChart";
import CrossTabulation from "@/components/vis/CrossTabulation";
import AIAnalytics from "@/components/vis/AIAnalytics";

type VisTabId = "frequencies" | "crosstab" | "analytics";

const TAB_META: { id: VisTabId; label: string }[] = [
  { id: "frequencies", label: "Frequencies" },
  { id: "crosstab", label: "Code × Document" },
  { id: "analytics", label: "AI Analytics" },
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
        className="flex border-b panel-border flex-shrink-0 px-2"
        aria-label="Visualisation tabs"
      >
        {TAB_META.map(({ id, label }) => (
          <Tabs.Trigger
            key={id}
            value={id}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              "data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400",
              "data-[state=active]:border-b-2 data-[state=active]:border-brand-500",
              "data-[state=inactive]:text-surface-400 dark:data-[state=inactive]:text-surface-500",
              "hover:text-surface-600 dark:hover:text-surface-300"
            )}
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="frequencies" className="flex-1 overflow-hidden">
        <FrequencyChart />
      </Tabs.Content>

      <Tabs.Content value="crosstab" className="flex-1 overflow-hidden">
        <CrossTabulation />
      </Tabs.Content>

      <Tabs.Content value="analytics" className="flex-1 overflow-hidden">
        <AIAnalytics />
      </Tabs.Content>
    </Tabs.Root>
  );
}
