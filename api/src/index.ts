import "dotenv/config";
import http from "node:http";
import pino from "pino";
import type { Logger } from "pino";
import { createApp } from "./app.js";
import { connectDb } from "./db.js";
import { getWebhookQueue } from "./services/queueService.js";
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
  await connectDb(logger);
  getWebhookQueue();
  const app = createApp(logger);
  const server = http.createServer(app);
  attachLogWebSocketServer(server, logger);
  const port = Number(process.env.PORT ?? "3001");
  server.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "api listening");
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, "fatal startup error");
  process.exit(1);
});
