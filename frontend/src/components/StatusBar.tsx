import { useStore } from "@/stores/store";
import { FileText, Hash, FolderOpen, Loader2 } from "lucide-react";

const AGENT_LABELS: Record<string, string> = {
  ghost_partner: "Ghost Partner",
  consistency: "Self-Consistency",
  analysis: "Analysis",
};

export default function StatusBar() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.projects);
  const documents = useStore((s) => s.documents);
  const codes = useStore((s) => s.codes);
  const segments = useStore((s) => s.segments);
  const agentsRunning = useStore((s) => s.agentsRunning);
  const alerts = useStore((s) => s.alerts);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Determine which agent is currently thinking
  const activeAgent = alerts.find((a) => a.type === "agent_thinking");
  const activeAgentLabel = activeAgent
    ? AGENT_LABELS[(activeAgent as any).agent] || (activeAgent as any).agent || "Agent"
    : null;

  return (
    <footer className="h-6 flex items-center justify-between px-3 border-t panel-border panel-bg text-2xs text-surface-400 dark:text-surface-500 flex-shrink-0 select-none">
      <div className="flex items-center gap-3">
        {activeProject ? (
          <>
            <span className="flex items-center gap-1">
              <FolderOpen size={10} />
              {activeProject.name}
            </span>
            <span className="flex items-center gap-1">
              <FileText size={10} />
              {documents.length} doc{documents.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Hash size={10} />
              {codes.length} code{codes.length !== 1 ? "s" : ""}
            </span>
            <span>
              {segments.length} segment{segments.length !== 1 ? "s" : ""}
            </span>
          </>
        ) : (
          <span>No project selected</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {agentsRunning && (
          <span className="flex items-center gap-1 text-brand-500 dark:text-brand-400">
            <Loader2 size={10} className="animate-spin" />
            {activeAgentLabel ? `${activeAgentLabel} running` : "Agents running"}
          </span>
        )}
        <span className="text-surface-300 dark:text-surface-600">v1.0</span>
      </div>
    </footer>
  );
}
