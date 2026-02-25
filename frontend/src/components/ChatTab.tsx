import { useState, useRef, useEffect } from "react";
import { useStore } from "@/stores/store";
import { MessageCircle, Send, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Summarise the key themes so far",
  "Are there any contradictions in my codes?",
  "What patterns do you see across all segments?",
] as const;

export default function ChatTab() {
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

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 thin-scrollbar space-y-2"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {chatMessages.length === 0 && !chatStreaming && (
          <div className="text-center mt-6 view-enter">
            <MessageCircle
              size={24}
              className="mx-auto text-surface-300 dark:text-surface-600 mb-2"
              aria-hidden="true"
            />
            <p className="text-xs text-surface-400 dark:text-surface-500 italic mb-3">
              Chat with your data. Ask about patterns, definitions, or coding
              decisions.
            </p>
            <div className="space-y-1.5" role="group" aria-label="Suggested questions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setMessage("");
                    sendChatMessage(s);
                  }}
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
            {/* Streaming cursor */}
            {chatStreaming &&
              i === chatMessages.length - 1 &&
              msg.role === "assistant" && (
                <span
                  className="inline-block w-1.5 h-3 ml-0.5 bg-brand-500 animate-pulse rounded-sm align-text-bottom"
                  aria-label="Loading response"
                />
              )}
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className="p-2 border-t panel-border flex gap-1.5 items-center">
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            title="New conversation"
            aria-label="Clear chat and start new conversation"
            className="rounded p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        )}
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            chatStreaming
              ? "Waiting for response..."
              : "Ask about your data..."
          }
          disabled={chatStreaming}
          aria-label="Chat message input"
          className="flex-1 rounded border panel-border px-2 py-1 text-xs bg-transparent dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-50"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={chatStreaming || !message.trim()}
          aria-label="Send message"
          className="rounded bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"
        >
          {chatStreaming ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <Send size={12} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
