import type { ChatMessageOut } from "@/types";
import * as api from "@/api/client";

const CURRENT_USER = "default";

export interface ChatSlice {
  chatMessages: ChatMessageOut[];
  chatConversationId: string | null;
  chatStreaming: boolean;
  sendChatMessage: (text: string) => Promise<void>;
  appendChatToken: (token: string) => void;
  finishChatStream: () => void;
  clearChat: () => void;
  loadChatHistory: (conversationId: string) => Promise<void>;
}

export const createChatSlice = (
  set: (updater: any) => void,
  get: () => any,
): ChatSlice => ({
  chatMessages: [],
  chatConversationId: null,
  chatStreaming: false,

  sendChatMessage: async (text) => {
    const { activeProjectId, chatConversationId } = get();
    if (!activeProjectId) return;

    // Optimistically append the user message immediately
    const userMsg: ChatMessageOut = {
      id: "temp-" + Date.now(),
      conversation_id: chatConversationId || "pending",
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    set((s: any) => ({ chatMessages: [...s.chatMessages, userMsg] }));

    try {
      const res = await api.sendChatMessage(
        text,
        activeProjectId,
        CURRENT_USER,
        chatConversationId,
      );
      const assistantPlaceholder: ChatMessageOut = {
        id: "streaming-" + Date.now(),
        conversation_id: res.conversation_id,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      set((s: any) => ({
        chatConversationId: res.conversation_id,
        chatStreaming: true,
        chatMessages: [
          ...s.chatMessages.map((m: ChatMessageOut) =>
            m.conversation_id === "pending"
              ? { ...m, conversation_id: res.conversation_id }
              : m,
          ),
          assistantPlaceholder,
        ],
      }));
    } catch (e) {
      console.error("Chat send error:", e);
      set({ chatStreaming: false });
    }
  },

  appendChatToken: (token) =>
    set((s: any) => {
      const msgs = [...s.chatMessages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + token };
      }
      return { chatMessages: msgs };
    }),

  finishChatStream: () => set({ chatStreaming: false }),

  clearChat: () => set({ chatMessages: [], chatConversationId: null, chatStreaming: false }),

  loadChatHistory: async (conversationId) => {
    const msgs = await api.fetchChatHistory(conversationId);
    set({ chatMessages: msgs, chatConversationId: conversationId, chatStreaming: false });
  },
});
