import "dotenv/config";
import http from "node:http";
import pino from "pino";
import type { Logger } from "pino";
import { createApp } from "./app.js";
import { validateApiConfig } from "./config.js";
import { connectDb } from "./db.js";
import { getWebhookQueue } from "./services/queueService.js";
import { startStaleRunRecovery } from "./services/staleRunRecovery.js";
import { attachLogWebSocketServer } from "./ws/logStream.js";

function createRootLogger(): Logger {
  // Pino's callable default export is a `Logger` factory; ESLint's typed rules still treat the call as loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- pino default export factory
  return pino({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  });
}

const logger = createRootLogger();

async function main(): Promise<void> {
  validateApiConfig(logger);
  await connectDb(logger);
  getWebhookQueue();
  const recovery = startStaleRunRecovery(logger);
  const app = createApp(logger);
  const server = http.createServer(app);
  attachLogWebSocketServer(server, logger);
  const port = Number(process.env.PORT ?? "3001");
  server.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "api listening");
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "api shutting down");
    const timeoutMs = 15_000;
    const timeout = setTimeout(() => {
      logger.error({ timeoutMs }, "api shutdown timeout exceeded; exiting");
      process.exit(1);
    }, timeoutMs);

    server.close(() => {
      recovery.stop();
      clearTimeout(timeout);
      logger.info("api server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  logger.error({ err }, "fatal startup error");
  process.exit(1);
});
