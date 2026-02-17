import { useEffect, useRef } from "react";
import { useStore } from "@/stores/store";

const RECONNECT_DELAY = 3000;

export function useWebSocket() {
  const currentUser = useStore((s) => s.currentUser);
  const pushAlert = useStore((s) => s.pushAlert);
  const loadAnalyses = useStore((s) => s.loadAnalyses);
  const loadCodes = useStore((s) => s.loadCodes);
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
          const alert = JSON.parse(event.data);
          pushAlert(alert);

          if (alert.type === "analysis_updated") {
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
