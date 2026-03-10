import { Loader2, Send } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  return (
    <div className="p-2 border-t panel-border flex gap-1.5 items-center">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={disabled ? "Waiting for response..." : "Ask about your data..."}
        disabled={disabled}
        aria-label="Chat message input"
        className="flex-1 rounded border panel-border px-2 py-1 text-xs bg-transparent dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-50"
        onKeyDown={(e) => e.key === "Enter" && onSend()}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="rounded bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"
      >
        {disabled ? (
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        ) : (
          <Send size={12} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
