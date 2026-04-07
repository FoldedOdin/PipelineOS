import { useCallback, useEffect, useRef, useState } from "react";

export interface LogLine {
  stageName: string;
  line: string;
  timestamp: string;
}

type LogStreamEvent =
  | { type: "hello"; runId: string; timestamp: string }
  | { type: "log"; runId: string; stageName: string; chunk: string; timestamp: string }
  | { type: "stage_status"; runId: string; stageName: string; status: string; timestamp: string }
  | { type: "run_status"; runId: string; status: string; timestamp: string };

export type LogStreamState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "open"; lines: LogLine[] }
  | { status: "closed"; reason: string }
  | { status: "error"; message: string };

function parseEvent(raw: string): LogStreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const type = (parsed as Record<string, unknown>).type;
    if (type === "hello") {
      const runId = (parsed as Record<string, unknown>).runId;
      const timestamp = (parsed as Record<string, unknown>).timestamp;
      if (typeof runId === "string" && typeof timestamp === "string") return { type, runId, timestamp };
      return null;
    }
    if (type === "log") {
      const runId = (parsed as Record<string, unknown>).runId;
      const stageName = (parsed as Record<string, unknown>).stageName;
      const chunk = (parsed as Record<string, unknown>).chunk;
      const timestamp = (parsed as Record<string, unknown>).timestamp;
      if (typeof runId === "string" && typeof stageName === "string" && typeof chunk === "string" && typeof timestamp === "string") {
        return { type, runId, stageName, chunk, timestamp };
      }
      return null;
    }
    if (type === "stage_status") {
      const runId = (parsed as Record<string, unknown>).runId;
      const stageName = (parsed as Record<string, unknown>).stageName;
      const status = (parsed as Record<string, unknown>).status;
      const timestamp = (parsed as Record<string, unknown>).timestamp;
      if (typeof runId === "string" && typeof stageName === "string" && typeof status === "string" && typeof timestamp === "string") {
        return { type, runId, stageName, status, timestamp };
      }
      return null;
    }
    if (type === "run_status") {
      const runId = (parsed as Record<string, unknown>).runId;
      const status = (parsed as Record<string, unknown>).status;
      const timestamp = (parsed as Record<string, unknown>).timestamp;
      if (typeof runId === "string" && typeof status === "string" && typeof timestamp === "string") return { type, runId, status, timestamp };
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

function splitLinesPreservingRemainder(input: string): { lines: string[]; remainder: string } {
  const normalized = input.replaceAll("\r\n", "\n");
  const parts = normalized.split("\n");
  if (parts.length <= 1) return { lines: [], remainder: normalized };
  const remainder = parts.pop() ?? "";
  return { lines: parts, remainder };
}

/**
 * Opens a WebSocket to `/ws/runs/:id` and accumulates structured log events.
 */
export function useLogStream(runId: string | undefined): {
  state: LogStreamState;
  reconnect: () => void;
} {
  const [state, setState] = useState<LogStreamState>({ status: "idle" });
  const socketRef = useRef<WebSocket | null>(null);
  const linesRef = useRef<LogLine[]>([]);
  const partialByStageRef = useRef<Record<string, string>>({});
  const maxLines = 5000;

  const connect = useCallback(() => {
    if (runId === undefined || runId === "") {
      setState({ status: "error", message: "missing run id" });
      return;
    }

    socketRef.current?.close();
    linesRef.current = [];
    partialByStageRef.current = {};
    setState({ status: "connecting" });

    const baseWs = import.meta.env.VITE_WS_URL;
    const url = `${baseWs.replace(/\/$/, "")}/ws/runs/${runId}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      linesRef.current = [];
      partialByStageRef.current = {};
      setState({ status: "open", lines: [] });
    };

    ws.onmessage = (event) => {
      const raw = typeof event.data === "string" ? event.data : "";
      const parsed = parseEvent(raw);
      if (parsed === null) {
        linesRef.current = [...linesRef.current, { stageName: "stream", line: raw, timestamp: new Date().toISOString() }].slice(-maxLines);
        setState({ status: "open", lines: linesRef.current });
        return;
      }

      if (parsed.type === "log") {
        const prevPartial = partialByStageRef.current[parsed.stageName] ?? "";
        const joined = `${prevPartial}${parsed.chunk}`;
        const { lines, remainder } = splitLinesPreservingRemainder(joined);
        partialByStageRef.current[parsed.stageName] = remainder;
        if (lines.length > 0) {
          const next = [
            ...linesRef.current,
            ...lines.map((line) => ({ stageName: parsed.stageName, line, timestamp: parsed.timestamp })),
          ].slice(-maxLines);
          linesRef.current = next;
          setState({ status: "open", lines: next });
        }
        return;
      }

      if (parsed.type === "stage_status") {
        const next = [
          ...linesRef.current,
          { stageName: parsed.stageName, line: `stage ${parsed.stageName} -> ${parsed.status}`, timestamp: parsed.timestamp },
        ].slice(-maxLines);
        linesRef.current = next;
        setState({ status: "open", lines: next });
        return;
      }

      if (parsed.type === "run_status") {
        const next = [
          ...linesRef.current,
          { stageName: "run", line: `run -> ${parsed.status}`, timestamp: parsed.timestamp },
        ].slice(-maxLines);
        linesRef.current = next;
        setState({ status: "open", lines: next });
        return;
      }
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
