import { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useStore } from "@/stores/store";
import { ChevronDown, FileText, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentsTabContent } from "@/features/documents";
import { CodesTabContent } from "@/features/codes";
import ProjectHeader from "./ProjectHeader";
import ProjectList from "./ProjectList";

interface LeftPanelProps {
  onCollapse?: () => void;
}

export default function LeftPanel({ onCollapse }: LeftPanelProps) {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const [docsOpen, setDocsOpen] = useState(true);
  const [codesOpen, setCodesOpen] = useState(true);

  if (!activeProjectId) return <ProjectList />;

  /** Trigger class shared by both section headers */
  const triggerCn = cn(
    "flex items-center gap-1.5 px-2 py-2 border-b panel-border flex-shrink-0 cursor-pointer transition-colors",
    "text-2xs font-semibold uppercase tracking-wider",
    "text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800",
    "focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-[-2px]"
  );

  return (
    <div className="flex flex-col h-full panel-bg overflow-hidden">
      <ProjectHeader onCollapse={onCollapse} />

      {/* Documents sizes to content (max 40%); codes fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* ---- DOCUMENTS ---- */}
        <Collapsible.Root
          open={docsOpen}
          onOpenChange={setDocsOpen}
          className={cn(
            "flex flex-col min-h-0 overflow-hidden flex-shrink-0",
            docsOpen && !codesOpen && "flex-1",
            docsOpen && codesOpen && "max-h-[40%]"
          )}
        >
          <Collapsible.Trigger
            className={triggerCn}
            aria-label={docsOpen ? "Collapse documents section" : "Expand documents section"}
          >
            <ChevronDown
              size={10}
              className={cn("transition-transform duration-200", !docsOpen && "-rotate-90")}
              aria-hidden="true"
            />
            <FileText size={10} aria-hidden="true" />
            <span>Documents</span>
          </Collapsible.Trigger>

          <Collapsible.Content className="collapsible-content flex-1 min-h-0 overflow-hidden">
            <DocumentsTabContent />
          </Collapsible.Content>
        </Collapsible.Root>

        {/* ---- CODES ---- */}
        <Collapsible.Root
          open={codesOpen}
          onOpenChange={setCodesOpen}
          className={cn("flex flex-col min-h-0 overflow-hidden flex-1")}
        >
          <Collapsible.Trigger
            className={triggerCn}
            aria-label={codesOpen ? "Collapse codes section" : "Expand codes section"}
          >
            <ChevronDown
              size={10}
              className={cn("transition-transform duration-200", !codesOpen && "-rotate-90")}
              aria-hidden="true"
            />
            <Hash size={10} aria-hidden="true" />
            <span>Codes</span>
          </Collapsible.Trigger>

          <Collapsible.Content className="collapsible-content flex-1 min-h-0 overflow-hidden">
            <CodesTabContent />
          </Collapsible.Content>
        </Collapsible.Root>
      </div>
    </div>
  );
}

