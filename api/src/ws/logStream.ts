import type { Server } from "http";
import type { Logger } from "pino";

/**
 * Attaches the `/ws` log streaming server to the HTTP server.
 * Implemented when runner log fan-out and replay are wired.
 */
export function attachLogWebSocketServer(httpServer: Server, logger: Logger): void {
  void httpServer;
  void logger;
  // no-op until WebSocket milestone
}
