import { useEffect, useRef } from "react";
import { useStore } from "@/stores/store";

const RECONNECT_DELAY = 3000;

export function useWebSocket() {
  const token = useStore((s) => s.token);
  const pushAlert = useStore((s) => s.pushAlert);
  const loadAnalyses = useStore((s) => s.loadAnalyses);
  const loadCodes = useStore((s) => s.loadCodes);
  const appendChatToken = useStore((s) => s.appendChatToken);
  const finishChatStream = useStore((s) => s.finishChatStream);
  const triggerVisRefresh = useStore((s) => s.triggerVisRefresh);
  const setOverlapMatrix = useStore((s) => s.setOverlapMatrix);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;

    function connect() {
      if (disposed || !token) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/ws?token=${encodeURIComponent(token)}`;
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

          // facet_updated — trigger vis refresh without pushing to alerts
          if (msg.type === "facet_updated") {
            triggerVisRefresh();
            return;
          }

          // code_overlap_matrix — update store directly, do not push to alerts
          if (msg.type === "code_overlap_matrix") {
            setOverlapMatrix(msg.data as Record<string, Record<string, number>>);
            return;
          }

          pushAlert(msg);

          if (msg.type === "analysis_updated") {
            void Promise.all([loadAnalyses(), loadCodes()]);
          }

          // Audit completion events — refresh vis tabs with new data
          if (
            msg.type === "coding_audit" ||
            msg.type === "agents_done" ||
            msg.type === "batch_audit_done" ||
            msg.type === "challenge_result"
          ) {
            triggerVisRefresh();
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
  }, [token]);
}
