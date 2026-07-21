/**
 * logStream.ts
 *
 * Real-time log and status delivery to browser clients.
 *
 * Two transports are provided — clients can use whichever suits their environment:
 *
 *   WebSocket   ws://<host>/ws/runs/:runId
 *   SSE         GET /api/runs/:id/stream   (EventSource-compatible)
 *
 * Both require a valid session (JWT cookie) or an explicit `?token=<jwt>` query
 * parameter so unauthenticated browsers cannot tail arbitrary run logs.
 *
 * Event shape (same for both transports, JSON-serialised):
 *   { type: "hello",        runId, timestamp }
 *   { type: "log",          runId, stageName, chunk, timestamp }
 *   { type: "stage_status", runId, stageName, status, timestamp }
 *   { type: "run_status",   runId, status, timestamp }
 */
import type { IncomingMessage } from "http";
import type { Server } from "http";
import type { Request, Response } from "express";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { Logger } from "pino";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type LogStreamEvent =
  | { type: "hello"; runId: string; timestamp: string }
  | { type: "log"; runId: string; stageName: string; chunk: string; timestamp: string }
  | { type: "stage_status"; runId: string; stageName: string; status: string; timestamp: string }
  | { type: "run_status"; runId: string; status: string; timestamp: string };

// ---------------------------------------------------------------------------
// Client registries
// ---------------------------------------------------------------------------

type WsClient = WebSocket;
const wsClientsByRunId = new Map<string, Set<WsClient>>();

// SSE: each client is an Express Response with the stream kept open.
const sseClientsByRunId = new Map<string, Set<Response>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback_secret_do_not_use_in_prod";

/**
 * Validate a JWT from a cookie header string or explicit token value.
 * Returns true in test mode so unit tests don't need real tokens.
 */
function isAuthorised(tokenValue: string | undefined): boolean {
  if (process.env.NODE_ENV === "test") return true;
  if (!tokenValue) return false;
  try {
    jwt.verify(tokenValue, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

/** Extract `token` cookie value from a raw `Cookie:` header string. */
function extractCookieToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const match = /(?:^|;\s*)token=([^;]+)/.exec(cookieHeader);
  return match?.[1];
}

/** Parse runId from `/ws/runs/:runId` or `/api/runs/:runId/stream`. */
function parseRunIdFromPath(rawUrl: string): string | null {
  const path = (rawUrl.split("?")[0] ?? "").split("#")[0] ?? "";
  // WebSocket path
  let m = /^\/ws\/runs\/([^/]+)$/.exec(path);
  if (m) return decodeURIComponent(m[1] ?? "");
  // SSE path (handled by Express router, but keep consistent)
  m = /^\/api\/runs\/([^/]+)\/stream$/.exec(path);
  if (m) return decodeURIComponent(m[1] ?? "");
  return null;
}

// ---------------------------------------------------------------------------
// Broadcast to all transports
// ---------------------------------------------------------------------------

function broadcastWs(runId: string, event: LogStreamEvent): void {
  const clients = wsClientsByRunId.get(runId);
  if (!clients || clients.size === 0) return;
  const payload = safeJsonStringify(event);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

function broadcastSse(runId: string, event: LogStreamEvent): void {
  const clients = sseClientsByRunId.get(runId);
  if (!clients || clients.size === 0) return;
  const data = safeJsonStringify(event);
  const frame = `data: ${data}\n\n`;
  for (const res of clients) {
    try {
      res.write(frame);
    } catch {
      // client disconnected; will be cleaned up by the close handler
    }
  }
}

function broadcast(runId: string, event: LogStreamEvent): void {
  broadcastWs(runId, event);
  broadcastSse(runId, event);
}

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

/**
 * Attaches the WebSocket log streaming server to an existing HTTP server.
 * Connect to `ws://<host>/ws/runs/:runId` (or `wss://` in production).
 * Pass a JWT in the `token` cookie or `?token=<jwt>` query parameter.
 */
export function attachLogWebSocketServer(httpServer: Server, logger: Logger): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = req.url ?? "";
    const runId = parseRunIdFromPath(url);

    if (runId === null || runId === "") {
      socket.destroy();
      return;
    }

    // Auth: try cookie first, then ?token= query param.
    const qs = new URLSearchParams(url.includes("?") ? url.slice(url.indexOf("?") + 1) : "");
    const cookieToken = extractCookieToken(req.headers.cookie);
    const queryToken = qs.get("token") ?? undefined;
    const token = cookieToken ?? queryToken;

    if (!isAuthorised(token)) {
      logger.warn({ runId }, "websocket upgrade rejected: unauthorised");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, runId);
    });
  });

  wss.on("connection", (ws: WsClient, _req: IncomingMessage, runId: string) => {
    let set = wsClientsByRunId.get(runId);
    if (!set) {
      set = new Set<WsClient>();
      wsClientsByRunId.set(runId, set);
    }
    set.add(ws);

    ws.send(safeJsonStringify({ type: "hello", runId, timestamp: nowIso() } satisfies LogStreamEvent));

    ws.on("close", () => {
      const current = wsClientsByRunId.get(runId);
      if (!current) return;
      current.delete(ws);
      if (current.size === 0) wsClientsByRunId.delete(runId);
    });

    ws.on("error", (err) => {
      logger.debug({ err, runId }, "websocket client error");
    });
  });

  logger.info("websocket log stream attached");
}

// ---------------------------------------------------------------------------
// SSE handler (used by Express router)
// ---------------------------------------------------------------------------

/**
 * Express route handler for `GET /api/runs/:id/stream`.
 *
 * Keeps the HTTP connection open and pushes newline-delimited Server-Sent
 * Events as log chunks, stage status changes, and run status changes arrive.
 *
 * Auth is handled by the Express `requireAuth` middleware that wraps /api/*.
 */
export function handleSseStream(req: Request, res: Response): void {
  const runId = typeof req.params.id === "string" ? req.params.id : (Array.isArray(req.params.id) ? req.params.id[0] : "") ?? "";
  if (runId === "") {
    res.status(400).json({ error: "missing_run_id" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Register this response as a streaming client.
  let set = sseClientsByRunId.get(runId);
  if (!set) {
    set = new Set<Response>();
    sseClientsByRunId.set(runId, set);
  }
  set.add(res);

  // Send initial "hello" event.
  res.write(`data: ${safeJsonStringify({ type: "hello", runId, timestamp: nowIso() })}\n\n`);

  // Keep-alive ping every 25 s so proxies don't close idle connections.
  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    const current = sseClientsByRunId.get(runId);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) sseClientsByRunId.delete(runId);
  });
}

// ---------------------------------------------------------------------------
// Publisher functions (called from runnerService)
// ---------------------------------------------------------------------------

export function publishStageLog(runId: string, stageName: string, chunk: string): void {
  if (!runId || !stageName || !chunk) return;
  broadcast(runId, { type: "log", runId, stageName, chunk, timestamp: nowIso() });
}

export function publishStageStatus(runId: string, stageName: string, status: string): void {
  if (!runId || !stageName || !status) return;
  broadcast(runId, { type: "stage_status", runId, stageName, status, timestamp: nowIso() });
}

export function publishRunStatus(runId: string, status: string): void {
  if (!runId || !status) return;
  broadcast(runId, { type: "run_status", runId, status, timestamp: nowIso() });
}
