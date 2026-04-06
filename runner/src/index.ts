import "dotenv/config";
import pino from "pino";
import type { Logger } from "pino";
import { executeQueuedRun } from "./executor.js";

function createRunnerLogger(): Logger {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- pino default export factory
  return pino({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  });
}

const logger = createRunnerLogger();

/**
 * Runner entrypoint: polls the API for queued runs and executes pipeline stages.
 * Polling and Docker execution are implemented in later milestones.
 */
function main(): void {
  const intervalMs = 2000;
  logger.info({ intervalMs }, "runner scaffold started; polling loop reserved");
  setInterval(() => {
    void executeQueuedRun();
    logger.debug("runner heartbeat");
  }, intervalMs);
}

main();
