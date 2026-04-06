import { useCallback, useEffect, useRef, useState } from "react";

export interface LogLine {
  stageName: string;
  line: string;
  timestamp: string;
}

export type LogStreamState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "open"; lines: LogLine[] }
  | { status: "closed"; reason: string }
  | { status: "error"; message: string };

/**
 * Opens a WebSocket to `/ws/runs/:id` and accumulates structured log events.
 * Full message parsing ships with the live logs milestone.
 */
export function useLogStream(runId: string | undefined): {
  state: LogStreamState;
  reconnect: () => void;
} {
  const [state, setState] = useState<LogStreamState>({ status: "idle" });
  const socketRef = useRef<WebSocket | null>(null);
  const linesRef = useRef<LogLine[]>([]);

  const connect = useCallback(() => {
    if (runId === undefined || runId === "") {
      setState({ status: "error", message: "missing run id" });
      return;
    }

    socketRef.current?.close();
    linesRef.current = [];
    setState({ status: "connecting" });

    const baseWs = import.meta.env.VITE_WS_URL;
    const url = `${baseWs.replace(/\/$/, "")}/ws/runs/${runId}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      linesRef.current = [];
      setState({ status: "open", lines: [] });
    };

    ws.onmessage = (event) => {
      const raw = typeof event.data === "string" ? event.data : "";
      linesRef.current = [...linesRef.current, { stageName: "stream", line: raw, timestamp: new Date().toISOString() }];
      setState({ status: "open", lines: linesRef.current });
    };

    ws.onerror = () => {
      setState({ status: "error", message: "websocket error" });
    };

    ws.onclose = (event) => {
      setState({ status: "closed", reason: event.reason || "connection closed" });
    };
  }, [runId]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect]);

  return { state, reconnect: connect };
}
