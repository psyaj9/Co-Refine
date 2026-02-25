import { useState, useRef, useEffect } from "react";
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
  Trash2,
  ScanSearch,
  ShieldCheck,
  Users,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RightPanelTab } from "@/types";

const AGENT_LABELS: Record<string, string> = {
  coding_audit: "Coding Audit",
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
    { id: "alerts", label: "Alerts",  icon: AlertTriangle, badge: visibleAlertCount },
    { id: "chat",   label: "AI Chat", icon: MessageCircle },
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
  const applySuggestedCode = useStore((s) => s.applySuggestedCode);
  const keepMyCode = useStore((s) => s.keepMyCode);
  const codes = useStore((s) => s.codes);
  const activeProjectId = useStore((s) => s.activeProjectId);

  const visibleAlerts = alerts.filter(
    (a) => a.type !== "agents_started" && a.type !== "agents_done"
  );

  // Derive per-agent status from alerts
  const agentSteps = agentsRunning
    ? (["coding_audit", "analysis"] as const).map((key) => {
        const label = AGENT_LABELS[key];
        const isThinking = alerts.some(
          (a) => a.type === "agent_thinking" && a.agent === key
        );
        const hasResult = alerts.some(
          (a) =>
            (a.type === key ||
              (a.type === "analysis_updated" && key === "analysis") ||
              (a.type === "agent_error" && (a as any).agent === key))
        );
        const status: "pending" | "running" | "done" = hasResult
          ? "done"
          : isThinking
            ? "running"
            : "pending";
        return { key, label, status };
      })
    : [];

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
        <div className="mb-3 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 size={12} className="text-brand-500 animate-spin" />
            <span className="text-2xs font-semibold text-brand-700 dark:text-brand-300">
              Agents analysing your coding…
            </span>
          </div>
          <div className="space-y-1">
            {agentSteps.map((step) => (
              <div key={step.key} className="flex items-center gap-2">
                {step.status === "running" ? (
                  <Loader2 size={10} className="text-brand-500 animate-spin flex-shrink-0" />
                ) : step.status === "done" ? (
                  <CheckCircle2 size={10} className="text-green-500 flex-shrink-0" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full border border-surface-300 dark:border-surface-600 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    "text-2xs",
                    step.status === "running"
                      ? "text-brand-600 dark:text-brand-400 font-medium"
                      : step.status === "done"
                        ? "text-green-600 dark:text-green-400"
                        : "text-surface-400 dark:text-surface-500"
                  )}
                >
                  {step.label}
                  {step.status === "running" && "…"}
                </span>
              </div>
            ))}
          </div>
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
            {/* coding_audit: segment quote as primary body */}
            {alert.type === "coding_audit" && (alert.segment_text || alert.data?.segment_text) ? (
              <blockquote className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-2 my-1 text-2xs text-surface-600 dark:text-surface-300 italic line-clamp-3 pr-4">
                “{String((alert as any).segment_text || alert.data?.segment_text)}”
              </blockquote>
            ) : (
              <p className="text-2xs text-surface-600 dark:text-surface-300 line-clamp-4 pr-4">
                {alertBody(alert)}
              </p>
            )}

            {/* Coding Audit: dual-lens collapsible sections */}
            {alert.type === "coding_audit" && (
              <CodingAuditDetail
                alert={alert}
                alertIdx={alerts.indexOf(alert)}
                codes={codes}
                applySuggestedCode={applySuggestedCode}
                keepMyCode={keepMyCode}
              />
            )}

            {/* Legacy ghost partner conflict */}
            {alert.type === "ghost_partner" && alert.is_conflict && (
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => keepMyCode(alerts.indexOf(alert))}
                  className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30 transition"
                >
                  Keep my code
                </button>
                {alert.data?.predicted_code && codes.some((c) => c.label === (alert.data.predicted_code as string)) ? (
                  <button
                    onClick={() => applySuggestedCode(alert.segment_id!, alert.data.predicted_code as string, alerts.indexOf(alert))}
                    className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/30 transition"
                  >
                    Apply &ldquo;{String(alert.data.predicted_code)}&rdquo;
                  </button>
                ) : alert.data?.predicted_code ? (
                  <button
                    onClick={() => dismissAlert(alerts.indexOf(alert))}
                    className="flex-1 rounded px-2 py-1 text-2xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition"
                    title="This code doesn't exist in your codebook yet"
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            )}

            {/* Legacy consistency: alternative code suggestions */}
            {alert.type === "consistency" && Array.isArray(alert.data?.alternative_codes) && (alert.data.alternative_codes as string[]).length > 0 && (
              <div className="mt-2 space-y-1">
                <span className="text-2xs text-surface-500 dark:text-surface-400 font-medium">Suggested alternatives:</span>
                <div className="flex flex-wrap gap-1">
                  {(alert.data.alternative_codes as string[])
                    .filter((ac) => codes.some((c) => c.label === ac))
                    .map((ac) => (
                      <button
                        key={ac}
                        onClick={() => applySuggestedCode(alert.segment_id!, ac, alerts.indexOf(alert))}
                        className="rounded px-2 py-0.5 text-2xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30 transition"
                      >
                        Apply &ldquo;{ac}&rdquo;
                      </button>
                    ))}
                  <button
                    onClick={() => keepMyCode(alerts.indexOf(alert))}
                    className="rounded px-2 py-0.5 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30 transition"
                  >
                    Keep current
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ========== Coding Audit Detail Component ==========
function CodingAuditDetail({
  alert,
  alertIdx,
  codes,
  applySuggestedCode,
  keepMyCode,
}: {
  alert: any;
  alertIdx: number;
  codes: any[];
  applySuggestedCode: (segId: string, code: string, idx: number) => void;
  keepMyCode: (idx: number) => void;
}) {
  const [selfOpen, setSelfOpen] = useState(false);
  const [interOpen, setInterOpen] = useState(false);

  const selfLens = alert.data?.self_lens as Record<string, any> | undefined;
  const interLens = alert.data?.inter_rater_lens as Record<string, any> | undefined;
  if (!selfLens && !interLens) return null;

  const altCodes: string[] = Array.isArray(selfLens?.alternative_codes)
    ? (selfLens.alternative_codes as string[]).filter((c) => codes.some((code) => code.label === c))
    : [];

  return (
    <div className="mt-2 space-y-1.5">
      {/* Self-Consistency Lens */}
      {selfLens && (
        <div className="rounded border border-amber-200 dark:border-amber-800 overflow-hidden">
          <button
            onClick={() => setSelfOpen(!selfOpen)}
            className="w-full flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400"
          >
            <ShieldCheck size={9} />
            <span className="text-2xs font-semibold flex-1 text-left">Self-Consistency</span>
            <span className={cn("text-2xs px-1 rounded", selfLens.is_consistent ? "text-green-600" : "text-amber-600")}>
              {selfLens.consistency_score || "–"}
            </span>
            {selfOpen ? <ChevronDown size={9} /> : <ChevronRightIcon size={9} />}
          </button>
          {selfOpen && (
            <div className="px-2 py-1.5 space-y-1">
              {selfLens.suggestion && (
                <p className="text-2xs text-surface-600 dark:text-surface-300">{selfLens.suggestion}</p>
              )}
              {selfLens.drift_warning && (
                <p className="text-2xs text-amber-600 dark:text-amber-400 italic">{selfLens.drift_warning}</p>
              )}
              {altCodes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {altCodes.map((ac) => (
                    <button
                      key={ac}
                      onClick={() => applySuggestedCode(alert.segment_id, ac, alertIdx)}
                      className="rounded px-1.5 py-0.5 text-2xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition"
                    >
                      Apply &ldquo;{ac}&rdquo;
                    </button>
                  ))}
                  <button
                    onClick={() => keepMyCode(alertIdx)}
                    className="rounded px-1.5 py-0.5 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 transition"
                  >
                    Keep current
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inter-Rater Lens */}
      {interLens && (
        <div className="rounded border border-purple-200 dark:border-purple-800 overflow-hidden">
          <button
            onClick={() => setInterOpen(!interOpen)}
            className="w-full flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400"
          >
            <Users size={9} />
            <span className="text-2xs font-semibold flex-1 text-left">Inter-Rater</span>
            <span className={cn("text-2xs px-1 rounded", interLens.is_conflict ? "text-red-600" : "text-green-600")}>
              {interLens.is_conflict ? "conflict" : "agrees"}
            </span>
            {interOpen ? <ChevronDown size={9} /> : <ChevronRightIcon size={9} />}
          </button>
          {interOpen && (
            <div className="px-2 py-1.5 space-y-1">
              {interLens.predicted_code && (
                <p className="text-2xs text-surface-500 dark:text-surface-400">
                  Predicted: <span className="font-medium text-purple-700 dark:text-purple-300">&ldquo;{interLens.predicted_code}&rdquo;</span>
                </p>
              )}
              {interLens.conflict_explanation && (
                <p className="text-2xs text-surface-600 dark:text-surface-300">{interLens.conflict_explanation}</p>
              )}
              {interLens.is_conflict && interLens.predicted_code && codes.some((c) => c.label === interLens.predicted_code) && (
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => keepMyCode(alertIdx)}
                    className="flex-1 rounded px-1.5 py-0.5 text-2xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 transition"
                  >
                    Keep mine
                  </button>
                  <button
                    onClick={() => applySuggestedCode(alert.segment_id, interLens.predicted_code, alertIdx)}
                    className="flex-1 rounded px-1.5 py-0.5 text-2xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200 transition"
                  >
                    Apply &ldquo;{interLens.predicted_code}&rdquo;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========== Chat Tab ==========
function ChatTab() {
  const [message, setMessage] = useState("");
  const chatMessages = useStore((s) => s.chatMessages);
  const chatStreaming = useStore((s) => s.chatStreaming);
  const sendChatMessage = useStore((s) => s.sendChatMessage);
  const clearChat = useStore((s) => s.clearChat);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or streaming tokens
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  const handleSend = () => {
    const text = message.trim();
    if (!text || chatStreaming) return;
    setMessage("");
    sendChatMessage(text);
  };

  const SUGGESTIONS = [
    "Summarise the key themes so far",
    "Are there any contradictions in my codes?",
    "What patterns do you see across all segments?",
  ];

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 thin-scrollbar space-y-2">
        {chatMessages.length === 0 && !chatStreaming && (
          <div className="text-center mt-6">
            <MessageCircle size={24} className="mx-auto text-surface-300 dark:text-surface-600 mb-2" />
            <p className="text-xs text-surface-400 dark:text-surface-500 italic mb-3">
              Chat with your data. Ask about patterns, definitions, or coding decisions.
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setMessage(""); sendChatMessage(s); }}
                  className="block w-full text-left text-2xs px-3 py-1.5 rounded-lg border panel-border hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div
            key={msg.id || i}
            className={cn(
              "rounded-lg px-3 py-2 text-2xs max-w-[90%] whitespace-pre-wrap",
              msg.role === "user"
                ? "ml-auto bg-brand-500 text-white"
                : "mr-auto bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-200"
            )}
          >
            {msg.content}
            {/* Streaming cursor for the last assistant message */}
            {chatStreaming && i === chatMessages.length - 1 && msg.role === "assistant" && (
              <span className="inline-block w-1.5 h-3 ml-0.5 bg-brand-500 animate-pulse rounded-sm align-text-bottom" />
            )}
          </div>
        ))}
      </div>

      <div className="p-2 border-t panel-border flex gap-1.5 items-center">
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            title="New conversation"
            className="rounded p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={chatStreaming ? "Waiting for response..." : "Ask about your data..."}
          disabled={chatStreaming}
          className="flex-1 rounded border panel-border px-2 py-1 text-xs bg-transparent dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-50"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={chatStreaming || !message.trim()}
          className="rounded bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {chatStreaming ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </div>
    </div>
  );
}

// ========== Alert helpers ==========
function alertStyle(type: string): string {
  const styles: Record<string, string> = {
    coding_audit: "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10",
    consistency: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10",
    ghost_partner: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10",
    agent_thinking: "border-brand-100 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-900/5 animate-pulse-subtle",
    agent_error: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10",
    analysis_updated: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10",
  };
  return styles[type] || "border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800";
}

function alertIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    coding_audit: <ScanSearch size={12} className="text-indigo-500" />,
    consistency: <AlertTriangle size={12} className="text-amber-500" />,
    ghost_partner: <Ghost size={12} className="text-purple-500" />,
    agent_thinking: <Loader2 size={12} className="text-brand-400 animate-spin" />,
    agent_error: <AlertCircle size={12} className="text-red-500" />,
    analysis_updated: <BookOpen size={12} className="text-green-600" />,
  };
  return icons[type] || <CheckCircle2 size={12} className="text-surface-500" />;
}

function alertTitle(alert: any): string {
  switch (alert.type) {
    case "coding_audit": {
      const selfLens = alert.data?.self_lens as Record<string, any> | undefined;
      const interLens = alert.data?.inter_rater_lens as Record<string, any> | undefined;
      const baseLabel = alert.code_label || "Audit";
      const consistentFlag = selfLens?.is_consistent === false ? " (drift)" : "";
      const conflictFlag = interLens?.is_conflict ? " (conflict)" : "";
      return `${baseLabel}${consistentFlag}${conflictFlag}`;
    }
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
  if (alert.type === "coding_audit") {
    const self = data.self_lens as Record<string, any> | undefined;
    const inter = data.inter_rater_lens as Record<string, any> | undefined;
    const selfText = self?.suggestion || self?.reasoning || "";
    const interText = inter?.is_conflict ? (inter?.conflict_explanation || "") : "";
    return [selfText, interText].filter(Boolean).join(" • ") || "See details below.";
  }
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
