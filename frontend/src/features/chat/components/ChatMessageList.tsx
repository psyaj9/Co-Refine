import { MessageCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ChatMessageOut } from "@/shared/types";
import { useAutoScroll } from "../hooks/useAutoScroll";

interface ChatMessageListProps {
  messages: ChatMessageOut[];
  streaming: boolean;
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  "Summarise the key themes so far",
  "Are there any contradictions in my codes?",
  "What patterns do you see across all segments?",
] as const;

export default function ChatMessageList({ messages, streaming, onSuggestion }: ChatMessageListProps) {
  const scrollRef = useAutoScroll([messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto p-3 thin-scrollbar space-y-2"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      {messages.length === 0 && !streaming && (
        <div className="text-center mt-6 view-enter">
          <MessageCircle
            size={24}
            className="mx-auto text-surface-300 dark:text-surface-600 mb-2"
            aria-hidden="true"
          />
          <p className="text-xs text-surface-400 dark:text-surface-500 italic mb-3">
            Chat with your data. Ask about patterns, definitions, or coding decisions.
          </p>
          <div className="space-y-1.5" role="group" aria-label="Suggested questions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestion(s)}
                className="block w-full text-left text-2xs px-3 py-1.5 rounded-lg border panel-border hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-300 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <div
          key={msg.id || i}
          role="article"
          aria-label={msg.role === "user" ? "Your message" : "AI response"}
          className={cn(
            "rounded-lg px-3 py-2 text-2xs max-w-[90%] whitespace-pre-wrap",
            msg.role === "user"
              ? "ml-auto bg-brand-500 text-white"
              : "mr-auto bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-200",
          )}
        >
          {msg.content}
          {streaming && i === messages.length - 1 && msg.role === "assistant" && (
            <span
              className="inline-block w-1.5 h-3 ml-0.5 bg-brand-500 animate-pulse rounded-sm align-text-bottom"
              aria-label="Loading response"
            />
          )}
        </div>
      ))}
    </div>
  );
}
