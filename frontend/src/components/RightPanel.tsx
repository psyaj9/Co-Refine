import { useState } from "react";
import { useStore } from "@/stores/store";
import {
  AlertTriangle,
  CheckCircle2,
  Ghost,
  X,
  BookOpen,
  Loader2,
  AlertCircle,
  MessageCircle,
  Send,
  GitCompare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import RetrievedSegments from "./RetrievedSegments";
import type { RightPanelTab } from "@/types";

const AGENT_LABELS: Record<string, string> = {
  consistency: "Self-Consistency",
  ghost_partner: "Ghost Partner",
  analysis: "Inductive Analysis",
};

export default function RightPanel() {
  const rightPanelTab = useStore((s) => s.rightPanelTab);
  const setRightPanelTab = useStore((s) => s.setRightPanelTab);
  const alerts = useStore((s) => s.alerts);

  const visibleAlertCount = alerts.filter(
    (a) => a.type !== "agents_started" && a.type !== "agents_done"
  ).length;

  const tabs: { id: RightPanelTab; label: string; icon: typeof AlertTriangle; badge?: number }[] = [
    { id: "alerts", label: "Alerts", icon: AlertTriangle, badge: visibleAlertCount },
    { id: "segments", label: "Segments", icon: BookOpen },
    { id: "definitions", label: "Definitions", icon: GitCompare },
    { id: "chat", label: "AI Chat", icon: MessageCircle },
  ];

  return (
    <div className="flex flex-col h-full panel-bg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b panel-border flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRightPanelTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 text-2xs font-medium transition-colors relative",
              rightPanelTab === tab.id
                ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-500"
                : "text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300"
            )}
            title={tab.label}
          >
            <tab.icon size={11} />
            <span className="truncate">{tab.label}</span>
            {tab.badge ? (
              <span className="absolute -top-0.5 right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
                {tab.badge > 9 ? "9+" : tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {rightPanelTab === "alerts" && <AlertsTab />}
        {rightPanelTab === "segments" && <RetrievedSegments />}
        {rightPanelTab === "definitions" && <DefinitionsTab />}
        {rightPanelTab === "chat" && <ChatTab />}
      </div>
    </div>
  );
}

// ========== Alerts Tab ==========
function AlertsTab() {
  const alerts = useStore((s) => s.alerts);
  const agentsRunning = useStore((s) => s.agentsRunning);
  const dismissAlert = useStore((s) => s.dismissAlert);

  const visibleAlerts = alerts.filter(
    (a) => a.type !== "agents_started" && a.type !== "agents_done"
  );

  if (visibleAlerts.length === 0 && !agentsRunning) {
    return (
      <div className="p-4">
        <p className="text-xs text-surface-400 dark:text-surface-500 italic text-center mt-8">
          AI agents are monitoring your coding. Alerts will appear here as you work.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 overflow-auto thin-scrollbar h-full">
      {agentsRunning && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 px-3 py-2 animate-pulse-subtle">
          <Loader2 size={12} className="text-brand-500 animate-spin" />
          <span className="text-2xs font-medium text-brand-700 dark:text-brand-300">
            Agents analysing your coding…
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {visibleAlerts.map((alert, idx) => (
          <li
            key={idx}
            className={cn(
              "alert-slide rounded-lg border p-2.5 relative",
              alertStyle(alert.type)
            )}
          >
            {alert.type !== "agent_thinking" && (
              <button
                onClick={() => dismissAlert(alerts.indexOf(alert))}
                className="absolute top-1.5 right-1.5 text-surface-400 hover:text-surface-600"
              >
                <X size={10} />
              </button>
            )}
            <div className="flex items-center gap-1.5 mb-1">
              {alertIcon(alert.type)}
              <span className="text-2xs font-semibold">{alertTitle(alert)}</span>
            </div>
            <p className="text-2xs text-surface-600 dark:text-surface-300 line-clamp-4 pr-4">
              {alertBody(alert)}
            </p>

            {/* Ghost partner conflict: accept/reject */}
            {alert.type === "ghost_partner" && alert.is_conflict && (
              <div className="flex gap-1.5 mt-2">
                <button className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30 transition">
                  Keep my code
                </button>
                <button className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/30 transition">
                  Consider suggestion
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ========== Definitions Tab ==========
function DefinitionsTab() {
  const codes = useStore((s) => s.codes);
  const analyses = useStore((s) => s.analyses);

  const codesWithAnalyses = codes.filter((c) =>
    analyses.some((a) => a.code_id === c.id)
  );

  if (codesWithAnalyses.length === 0) {
    return (
      <div className="p-4 text-center mt-8">
        <GitCompare size={24} className="mx-auto text-surface-300 dark:text-surface-600 mb-2" />
        <p className="text-xs text-surface-400 dark:text-surface-500 italic">
          AI-inferred definitions will appear here after coding enough segments.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 overflow-auto thin-scrollbar h-full space-y-3">
      {codesWithAnalyses.map((code) => {
        const analysis = analyses.find((a) => a.code_id === code.id);
        if (!analysis) return null;

        return (
          <div key={code.id} className="rounded-lg border panel-border p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                style={{ backgroundColor: code.colour }}
              />
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-200">
                {code.label}
              </span>
              <span className="text-2xs text-surface-400 ml-auto">
                {code.segment_count} seg{code.segment_count !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Side by side comparison */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-surface-50 dark:bg-surface-800 p-2">
                <p className="text-2xs uppercase tracking-wider text-surface-400 font-semibold mb-1">
                  Your Definition
                </p>
                <p className="text-2xs text-surface-600 dark:text-surface-300">
                  {code.definition || <span className="italic text-surface-400">Not defined</span>}
                </p>
              </div>
              <div className="rounded bg-brand-50 dark:bg-brand-900/10 p-2">
                <p className="text-2xs uppercase tracking-wider text-brand-500 dark:text-brand-400 font-semibold mb-1">
                  AI-Inferred
                </p>
                <p className="text-2xs text-surface-600 dark:text-surface-300">
                  {analysis.definition || "No AI definition yet"}
                </p>
              </div>
            </div>

            {analysis.lens && (
              <div className="mt-2 rounded bg-amber-50 dark:bg-amber-900/10 p-2">
                <p className="text-2xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold mb-0.5">
                  Interpretive Lens
                </p>
                <p className="text-2xs text-surface-600 dark:text-surface-300">{analysis.lens}</p>
              </div>
            )}

            {analysis.reasoning && (
              <details className="mt-1.5">
                <summary className="text-2xs text-surface-400 cursor-pointer hover:text-surface-600">
                  View reasoning
                </summary>
                <p className="text-2xs text-surface-500 dark:text-surface-400 mt-1 pl-2 border-l-2 panel-border">
                  {analysis.reasoning}
                </p>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ========== Chat Tab ==========
function ChatTab() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text: message.trim() },
      { role: "ai", text: "AI chat is a planned feature. In the future, you'll be able to query your data, ask about code definitions, and explore patterns through conversation." },
    ]);
    setMessage("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-3 thin-scrollbar space-y-2">
        {messages.length === 0 && (
          <div className="text-center mt-8">
            <MessageCircle size={24} className="mx-auto text-surface-300 dark:text-surface-600 mb-2" />
            <p className="text-xs text-surface-400 dark:text-surface-500 italic">
              Chat with your data. Ask about patterns, definitions, or coding decisions.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg px-3 py-2 text-2xs max-w-[90%]",
              msg.role === "user"
                ? "ml-auto bg-brand-500 text-white"
                : "mr-auto bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-200"
            )}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div className="p-2 border-t panel-border flex gap-1.5">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about your data..."
          className="flex-1 rounded border panel-border px-2 py-1 text-xs bg-transparent dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-400"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          className="rounded bg-brand-600 p-1.5 text-white hover:bg-brand-700"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// ========== Alert helpers ==========
function alertStyle(type: string): string {
  const styles: Record<string, string> = {
    consistency: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10",
    ghost_partner: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10",
    ghost_thinking: "border-purple-100 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-900/5 animate-pulse-subtle",
    agent_thinking: "border-brand-100 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-900/5 animate-pulse-subtle",
    agent_error: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10",
    analysis_updated: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10",
  };
  return styles[type] || "border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800";
}

function alertIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    consistency: <AlertTriangle size={12} className="text-amber-500" />,
    ghost_partner: <Ghost size={12} className="text-purple-500" />,
    ghost_thinking: <Loader2 size={12} className="text-purple-400 animate-spin" />,
    agent_thinking: <Loader2 size={12} className="text-brand-400 animate-spin" />,
    agent_error: <AlertCircle size={12} className="text-red-500" />,
    analysis_updated: <BookOpen size={12} className="text-green-600" />,
  };
  return icons[type] || <CheckCircle2 size={12} className="text-surface-500" />;
}

function alertTitle(alert: any): string {
  switch (alert.type) {
    case "consistency":
      return alert.is_consistent === false ? "⚠ Drift Detected" : "✓ Consistent";
    case "ghost_partner":
      return alert.is_conflict ? "👻 Conflict" : "👻 Agrees";
    case "agent_thinking": {
      const label = AGENT_LABELS[alert.agent] || alert.agent || "Agent";
      return `🔍 ${label}...`;
    }
    case "agent_error": {
      const label = AGENT_LABELS[alert.agent] || alert.agent || "Agent";
      return `⚠ ${label} failed`;
    }
    case "analysis_updated":
      return `📖 ${alert.code_label || "Definition updated"}`;
    default:
      return "Agent Alert";
  }
}

function alertBody(alert: any): string {
  const data = alert.data || {};
  if (alert.type === "consistency")
    return data.suggestion || data.reasoning || data.drift_warning || "No details available";
  if (alert.type === "ghost_partner")
    return data.conflict_explanation || data.reasoning || "No details available";
  if (alert.type === "agent_thinking") {
    const label = AGENT_LABELS[alert.agent] || alert.agent || "Agent";
    return `${label} is reviewing your coding decision...`;
  }
  if (alert.type === "agent_error")
    return data.message || "An error occurred while processing.";
  if (alert.type === "analysis_updated")
    return data.definition || "Definition updated";
  return JSON.stringify(data).slice(0, 200);
}
