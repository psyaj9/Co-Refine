import { useState, useEffect } from "react";
import { useStore } from "@/shared/store";
import { History, SquarePen } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import ConversationList from "./ConversationList";
import ChatInput from "./ChatInput";
import ChatMessageList from "./ChatMessageList";

export default function ChatTab() {
  const [message, setMessage] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);

  const chatMessages = useStore((s) => s.chatMessages);
  const chatStreaming = useStore((s) => s.chatStreaming);
  const chatConversationId = useStore((s) => s.chatConversationId);
  const conversations = useStore((s) => s.conversations);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const sendChatMessage = useStore((s) => s.sendChatMessage);
  const clearChat = useStore((s) => s.clearChat);
  const loadChatHistory = useStore((s) => s.loadChatHistory);
  const loadConversations = useStore((s) => s.loadConversations);
  const deleteConversationById = useStore((s) => s.deleteConversationById);

  useEffect(() => {
    if (activeProjectId) loadConversations(activeProjectId);
  }, [activeProjectId, loadConversations]);

  const handleSend = () => {
    const text = message.trim();
    if (!text || chatStreaming) return;
    setMessage("");
    sendChatMessage(text);
  };

  const handleSuggestion = (text: string) => {
    setMessage("");
    sendChatMessage(text);
  };

  const activePreview = chatConversationId
    ? (conversations.find((c) => c.conversation_id === chatConversationId)?.preview ?? "")
    : "";

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b panel-border shrink-0">
        <button
          onClick={() => setShowSidebar((v) => !v)}
          aria-label="Toggle conversation history"
          aria-pressed={showSidebar}
          className={cn(
            "rounded p-1 transition-colors",
            showSidebar
              ? "text-brand-600 bg-brand-50 dark:bg-brand-900/30"
              : "text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800",
          )}
        >
          <History size={13} aria-hidden="true" />
        </button>
        <span className="flex-1 truncate text-2xs text-surface-500 dark:text-surface-400 italic px-1">
          {activePreview || "New conversation"}
        </span>
        <button
          onClick={clearChat}
          aria-label="Start new conversation"
          className="rounded p-1 text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <SquarePen size={13} aria-hidden="true" />
        </button>
      </div>

      {/* Body: optional sidebar + chat area */}
      <div className="flex flex-row flex-1 overflow-hidden">
        {showSidebar && (
          <div className="w-2/5 border-r panel-border overflow-hidden shrink-0">
            <ConversationList
              conversations={conversations}
              activeConversationId={chatConversationId}
              onSelect={(id) => {
                loadChatHistory(id);
                setShowSidebar(false);
              }}
              onDelete={deleteConversationById}
            />
          </div>
        )}

        <div className="flex flex-col flex-1 overflow-hidden">
          <ChatMessageList
            messages={chatMessages}
            streaming={chatStreaming}
            onSuggestion={handleSuggestion}
          />
          <ChatInput
            value={message}
            onChange={setMessage}
            onSend={handleSend}
            disabled={chatStreaming}
          />
        </div>
      </div>
    </div>
  );
}
