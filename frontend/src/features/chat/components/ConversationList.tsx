import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationPreview } from "@/types";

interface ConversationListProps {
  conversations: ConversationPreview[];
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
}

function getDateBucket(isoDate: string | null): string {
  if (!isoDate) return "Older";
  const d = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor(
    (now.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "This week";
  return "Older";
}

function formatRelativeDate(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Yesterday";
  if (diffD < 7)
    return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const BUCKET_ORDER = ["Today", "Yesterday", "This week", "Older"];

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onDelete,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-2xs text-surface-400 dark:text-surface-500 italic px-3 text-center">
        No previous conversations
      </div>
    );
  }

  const grouped = conversations.reduce<Record<string, ConversationPreview[]>>(
    (acc, conv) => {
      const bucket = getDateBucket(conv.started_at);
      (acc[bucket] ??= []).push(conv);
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-col h-full overflow-auto thin-scrollbar py-1">
      {BUCKET_ORDER.filter((b) => grouped[b]?.length).map((bucket) => (
        <div key={bucket}>
          <p className="px-2 pt-2 pb-0.5 text-2xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide">
            {bucket}
          </p>
          {grouped[bucket].map((conv) => (
            <div
              key={conv.conversation_id}
              className={cn(
                "group flex items-center gap-1 mx-1 rounded px-2 py-1.5 cursor-pointer",
                conv.conversation_id === activeConversationId
                  ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                  : "hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300",
              )}
              onClick={() => onSelect(conv.conversation_id)}
              role="button"
              tabIndex={0}
              aria-label={`Load conversation: ${conv.preview}`}
              onKeyDown={(e) => e.key === "Enter" && onSelect(conv.conversation_id)}
            >
              <span className="flex-1 truncate text-2xs leading-tight">
                {conv.preview || "Empty conversation"}
              </span>
              <span className="text-2xs text-surface-400 dark:text-surface-500 whitespace-nowrap shrink-0 group-hover:hidden">
                {formatRelativeDate(conv.started_at)}
              </span>
              <button
                className="hidden group-hover:flex items-center justify-center rounded p-0.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                aria-label="Delete conversation"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.conversation_id);
                }}
              >
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
