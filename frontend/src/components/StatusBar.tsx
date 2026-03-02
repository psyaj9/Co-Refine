import { useStore } from "@/stores/store";
import { FileText, Hash, FolderOpen, Loader2, Eye, Users } from "lucide-react";
import { AGENT_LABELS } from "@/lib/constants";

const PERSPECTIVE_LABELS: Record<string, { short: string; icon: typeof Eye }> = {
  self_consistency: { short: "Self-Consistency", icon: Eye },
  inter_rater: { short: "Inter-Rater", icon: Users },
};

export default function StatusBar() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.projects);
  const documents = useStore((s) => s.documents);
  const codes = useStore((s) => s.codes);
  const segments = useStore((s) => s.segments);
  const agentsRunning = useStore((s) => s.agentsRunning);
  const alerts = useStore((s) => s.alerts);
  const projectSettings = useStore((s) => s.projectSettings);
  const auditStage = useStore((s) => s.auditStage);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const activeAgent = alerts.find((a) => a.type === "agent_thinking");
  const activeAgentLabel = activeAgent
    ? AGENT_LABELS[activeAgent.agent ?? ""] || activeAgent.agent || "Agent"
    : null;

  const stageLabels = ["", "Embedding", "LLM Audit", "Escalation"];

  return (
    <footer className="h-6 flex items-center justify-between px-3 border-t panel-border panel-bg text-2xs text-surface-400 dark:text-surface-500 flex-shrink-0 select-none" role="contentinfo">
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
        {activeProject ? (
          <>
            <span className="flex items-center gap-1 min-w-0">
              <FolderOpen size={10} className="flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{activeProject.name}</span>
            </span>
            <span className="flex items-center gap-1">
              <FileText size={10} aria-hidden="true" />
              {documents.length} doc{documents.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Hash size={10} aria-hidden="true" />
              {codes.length} code{codes.length !== 1 ? "s" : ""}
            </span>
            <span>
              {segments.length} segment{segments.length !== 1 ? "s" : ""}
            </span>
            {/* Active perspectives indicator */}
            {projectSettings && (
              <span className="flex items-center gap-1 border-l pl-2 ml-1 panel-border" title="Active AI perspectives">
                {projectSettings.enabled_perspectives.map((p) => {
                  const meta = PERSPECTIVE_LABELS[p];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <span key={p} className="flex items-center gap-0.5" title={meta.short}>
                      <Icon size={10} aria-hidden="true" />
                      <span className="hidden sm:inline">{meta.short}</span>
                    </span>
                  );
                })}
              </span>
            )}
          </>
        ) : (
          <span>No project selected</span>
        )}
      </div>

      <div className="flex items-center gap-2" role="status" aria-live="polite">
        {agentsRunning && (
          <span className="flex items-center gap-1 text-brand-500 dark:text-brand-400">
            <Loader2 size={10} className="animate-spin" aria-hidden="true" />
            {auditStage.current > 0
              ? `Stage ${auditStage.current}: ${stageLabels[auditStage.current]}`
              : activeAgentLabel
                ? `${activeAgentLabel} running`
                : "Agents running"}
          </span>
        )}
        <span className="text-surface-300 dark:text-surface-600">v1.0</span>
      </div>
    </footer>
  );
}
