import { useEffect, useRef } from "react";
import { useStore } from "@/stores/store";

const RECONNECT_DELAY = 3000;

export function useWebSocket() {
  const currentUser = useStore((s) => s.currentUser);
  const pushAlert = useStore((s) => s.pushAlert);
  const loadAnalyses = useStore((s) => s.loadAnalyses);
  const loadCodes = useStore((s) => s.loadCodes);
  const appendChatToken = useStore((s) => s.appendChatToken);
  const finishChatStream = useStore((s) => s.finishChatStream);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;

    function connect() {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/ws/${encodeURIComponent(currentUser)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Chat streaming messages — handle without pushing to alerts
          if (msg.type === "chat_token") {
            appendChatToken(msg.token);
            return;
          }
          if (msg.type === "chat_done") {
            finishChatStream();
            return;
          }
          if (msg.type === "chat_stream_start" || msg.type === "chat_error") {
            // stream_start is handled by the store on send;
            // error: finish streaming and let store show the error
            if (msg.type === "chat_error") finishChatStream();
            return;
          }

          // Regular alert pipeline
          pushAlert(msg);

          if (msg.type === "analysis_updated") {
            loadAnalyses();
            loadCodes();
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!disposed) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [currentUser]);
}
