import { useStore } from "../stores/store";
import {
  AlertTriangle,
  CheckCircle2,
  Ghost,
  X,
  BookOpen,
  Loader2,
  Brain,
  AlertCircle,
} from "lucide-react";

const AGENT_LABELS: Record<string, string> = {
  consistency: "Self-Consistency",
  ghost_partner: "Ghost Partner",
  analysis: "Inductive Analysis",
};

export default function AlertPanel() {
  const alerts = useStore((s) => s.alerts);
  const agentsRunning = useStore((s) => s.agentsRunning);
  const dismissAlert = useStore((s) => s.dismissAlert);

  if (alerts.length === 0 && !agentsRunning) {
    return (
      <aside className="w-72 flex-shrink-0 border-l border-slate-200 bg-white p-4 hidden lg:block">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Agent Alerts
        </h2>
        <p className="text-xs text-slate-400 italic">
          AI agents are watching... Alerts will appear here in real time as you
          code.
        </p>
      </aside>
    );
  }

  // Filter out transient lifecycle alerts from the rendered list (they power the banner instead)
  const visibleAlerts = alerts.filter(
    (a) => a.type !== "agents_started" && a.type !== "agents_done"
  );

  return (
    <aside className="w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-y-auto hidden lg:block">
      <div className="p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Agent Alerts{visibleAlerts.length > 0 ? ` (${visibleAlerts.length})` : ""}
        </h2>

        {/* Global "agents working" banner */}
        {agentsRunning && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 animate-pulse">
            <Loader2 size={14} className="text-blue-500 animate-spin" />
            <span className="text-xs font-medium text-blue-700">
              Agents analysing your coding…
            </span>
          </div>
        )}

        <ul className="space-y-2">
          {visibleAlerts.map((alert, idx) => (
            <li
              key={idx}
              className={`alert-slide rounded-lg border p-3 relative ${alertStyle(
                alert.type
              )}`}
            >
              {/* Only show dismiss button on non-thinking alerts */}
              {alert.type !== "agent_thinking" && (
                <button
                  onClick={() => dismissAlert(alerts.indexOf(alert))}
                  className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}

              <div className="flex items-center gap-2 mb-1">
                {alertIcon(alert.type)}
                <span className="text-xs font-semibold">
                  {alertTitle(alert)}
                </span>
              </div>

              <p className="text-xs text-slate-600 line-clamp-4">
                {alertBody(alert)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function alertStyle(type: string): string {
  switch (type) {
    case "consistency":
      return "border-amber-200 bg-amber-50";
    case "ghost_partner":
      return "border-purple-200 bg-purple-50";
    case "ghost_thinking":
      return "border-purple-100 bg-purple-50/50 animate-pulse";
    case "agent_thinking":
      return "border-blue-100 bg-blue-50/50 animate-pulse";
    case "agent_error":
      return "border-red-200 bg-red-50";
    case "analysis_updated":
      return "border-green-200 bg-green-50";
    default:
      return "border-slate-200 bg-slate-50";
  }
}

function alertIcon(type: string) {
  switch (type) {
    case "consistency":
      return <AlertTriangle size={14} className="text-amber-500" />;
    case "ghost_partner":
      return <Ghost size={14} className="text-purple-500" />;
    case "ghost_thinking":
      return <Loader2 size={14} className="text-purple-400 animate-spin" />;
    case "agent_thinking":
      return <Loader2 size={14} className="text-blue-400 animate-spin" />;
    case "agent_error":
      return <AlertCircle size={14} className="text-red-500" />;
    case "analysis_updated":
      return <BookOpen size={14} className="text-green-600" />;
    default:
      return <CheckCircle2 size={14} className="text-slate-500" />;
  }
}

function alertTitle(alert: any): string {
  switch (alert.type) {
    case "consistency":
      return alert.is_consistent === false
        ? "⚠ Consistency Drift Detected"
        : "✓ Consistent with your patterns";
    case "ghost_partner":
      return alert.is_conflict
        ? "👻 Ghost Partner Conflict"
        : "👻 Ghost Partner Agrees";
    case "ghost_thinking":
      return "👻 Ghost Partner Thinking...";
    case "agent_thinking": {
      const label = AGENT_LABELS[alert.agent] || alert.agent || "Agent";
      return `🔍 ${label} working...`;
    }
    case "agent_error": {
      const label = AGENT_LABELS[alert.agent] || alert.agent || "Agent";
      return `⚠ ${label} failed`;
    }
    case "analysis_updated":
      return `📖 Definition updated: ${alert.code_label || ""}`;
    default:
      return "Agent Alert";
  }
}

function alertBody(alert: any): string {
  const data = alert.data || {};
  if (alert.type === "consistency") {
    return (
      data.suggestion ||
      data.reasoning ||
      data.drift_warning ||
      "No details available"
    );
  }
  if (alert.type === "ghost_partner") {
    return (
      data.conflict_explanation ||
      data.reasoning ||
      "No details available"
    );
  }
  if (alert.type === "ghost_thinking") {
    return alert.token || "Analyzing your coding decision...";
  }
  if (alert.type === "agent_thinking") {
    const label = AGENT_LABELS[alert.agent] || alert.agent || "Agent";
    return `${label} is reviewing your coding decision...`;
  }
  if (alert.type === "agent_error") {
    return data.message || "An error occurred while processing.";
  }
  if (alert.type === "analysis_updated") {
    return data.definition || "Definition updated";
  }
  return JSON.stringify(data).slice(0, 200);
}
