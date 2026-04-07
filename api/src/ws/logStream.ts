import type { IncomingMessage } from "http";
import type { Server } from "http";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { Logger } from "pino";

type WsClient = WebSocket;

export type LogStreamEvent =
  | { type: "hello"; runId: string; timestamp: string }
  | { type: "log"; runId: string; stageName: string; chunk: string; timestamp: string }
  | { type: "stage_status"; runId: string; stageName: string; status: string; timestamp: string }
  | { type: "run_status"; runId: string; status: string; timestamp: string };

const clientsByRunId = new Map<string, Set<WsClient>>();

function nowIso(): string {
  return new Date().toISOString();
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ type: "error", message: "failed_to_serialize" });
  }
}

function broadcast(runId: string, event: LogStreamEvent): void {
  const clients = clientsByRunId.get(runId);
  if (clients === undefined || clients.size === 0) return;

  const payload = safeJsonStringify(event);
  for (const ws of clients) {
    if (ws.readyState !== ws.OPEN) continue;
    ws.send(payload);
  }
}

function parseRunIdFromRequest(req: IncomingMessage): string | null {
  const rawUrl = req.url ?? "";
  // Expected: /ws/runs/:runId
  const match = /^\/ws\/runs\/([^/?#]+)$/.exec(rawUrl.split("?")[0] ?? "");
  if (!match) return null;
  const runId = decodeURIComponent(match[1]);
  return runId !== "" ? runId : null;
}

/**
 * Attaches a WebSocket log streaming server to the HTTP server.
 *
 * Protocol: connect to `ws://<host>/ws/runs/:runId`.
 * Server will push newline-delimited log *chunks* as `{ type: "log", ... }` JSON messages.
 */
export function attachLogWebSocketServer(httpServer: Server, logger: Logger): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const runId = parseRunIdFromRequest(req);
    if (runId === null) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, runId);
    });
  });

  wss.on("connection", (ws: WsClient, _req: IncomingMessage, runId: string) => {
    let set = clientsByRunId.get(runId);
    if (set === undefined) {
      set = new Set<WsClient>();
      clientsByRunId.set(runId, set);
    }
    set.add(ws);

    ws.send(safeJsonStringify({ type: "hello", runId, timestamp: nowIso() } satisfies LogStreamEvent));

    ws.on("close", () => {
      const current = clientsByRunId.get(runId);
      if (current === undefined) return;
      current.delete(ws);
      if (current.size === 0) clientsByRunId.delete(runId);
    });

    ws.on("error", (err) => {
      logger.debug({ err, runId }, "websocket client error");
    });
  });

  logger.info("websocket log stream attached");
}

export function publishStageLog(runId: string, stageName: string, chunk: string): void {
  if (runId === "" || stageName === "" || chunk === "") return;
  broadcast(runId, { type: "log", runId, stageName, chunk, timestamp: nowIso() });
}

export function publishStageStatus(runId: string, stageName: string, status: string): void {
  if (runId === "" || stageName === "" || status === "") return;
  broadcast(runId, { type: "stage_status", runId, stageName, status, timestamp: nowIso() });
}

export function publishRunStatus(runId: string, status: string): void {
  if (runId === "" || status === "") return;
  broadcast(runId, { type: "run_status", runId, status, timestamp: nowIso() });
}
