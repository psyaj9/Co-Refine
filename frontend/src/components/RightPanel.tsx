import * as Tabs from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/store";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { tabContent, easeFast } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import AlertsTab from "@/components/AlertsTab";
import ChatTab from "@/components/ChatTab";
import type { RightPanelTab } from "@/types";

const TAB_META: {
  id: RightPanelTab;
  label: string;
  Icon: typeof AlertTriangle;
}[] = [
  { id: "alerts", label: "Alerts", Icon: AlertTriangle },
  { id: "chat", label: "AI Chat", Icon: MessageCircle },
];

export default function RightPanel() {
  const rightPanelTab = useStore((s) => s.rightPanelTab);
  const setRightPanelTab = useStore((s) => s.setRightPanelTab);
  const alerts = useStore((s) => s.alerts);
  const reduced = useReducedMotion();

  const visibleAlertCount = alerts.filter(
    (a) => a.type !== "agents_started" && a.type !== "agents_done"
  ).length;

  return (
    <Tabs.Root
      value={rightPanelTab}
      onValueChange={(v) => setRightPanelTab(v as RightPanelTab)}
      className="flex flex-col h-full panel-bg overflow-hidden"
    >
      <Tabs.List
        className="flex border-b panel-border flex-shrink-0"
        aria-label="Right panel tabs"
      >
        {TAB_META.map(({ id, label, Icon }) => (
          <Tabs.Trigger
            key={id}
            value={id}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 text-2xs font-medium transition-colors relative",
              "data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400",
              "data-[state=active]:border-b-2 data-[state=active]:border-brand-500",
              "data-[state=inactive]:text-surface-400 dark:data-[state=inactive]:text-surface-500",
              "hover:text-surface-600 dark:hover:text-surface-300"
            )}
          >
            <Icon size={11} aria-hidden="true" />
            <span className="truncate">{label}</span>
            {id === "alerts" && visibleAlertCount > 0 && (
              <span
                className="absolute -top-0.5 right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold"
                aria-label={`${visibleAlertCount} unread alert${visibleAlertCount !== 1 ? "s" : ""}`}
              >
                {visibleAlertCount > 9 ? "9+" : visibleAlertCount}
              </span>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content
        value="alerts"
        className="flex-1 overflow-hidden"
        forceMount
      >
        <AnimatePresence mode="wait">
          {rightPanelTab === "alerts" && (
            <motion.div
              key="alerts"
              variants={reduced ? undefined : tabContent}
              initial={reduced ? false : "initial"}
              animate="animate"
              exit="exit"
              transition={easeFast}
              className="h-full"
            >
              <AlertsTab />
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs.Content>

      <Tabs.Content
        value="chat"
        className="flex-1 overflow-hidden"
        forceMount
      >
        <AnimatePresence mode="wait">
          {rightPanelTab === "chat" && (
            <motion.div
              key="chat"
              variants={reduced ? undefined : tabContent}
              initial={reduced ? false : "initial"}
              animate="animate"
              exit="exit"
              transition={easeFast}
              className="h-full"
            >
              <ChatTab />
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs.Content>
    </Tabs.Root>
  );
}
