import "dotenv/config";
import pino from "pino";
import type { Logger } from "pino";
import { executeQueuedRun } from "./executor.js";
import { validateRunnerConfig } from "./config.js";

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
  validateRunnerConfig(logger);
  const intervalMs = 2000;
  logger.info({ intervalMs }, "runner scaffold started; polling loop reserved");
  let inFlight = false;
  let inFlightPromise: Promise<void> | null = null;
  let shuttingDown = false;

  const intervalId = setInterval(() => {
    if (shuttingDown) return;
    if (inFlight) return;
    inFlight = true;
    inFlightPromise = executeQueuedRun(logger)
      .catch((err: unknown) => {
        logger.error({ err }, "runner loop iteration failed");
      })
      .finally(() => {
        inFlight = false;
        inFlightPromise = null;
      });
    logger.debug("runner heartbeat");
  }, intervalMs);

  const beginShutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "runner shutting down");
    clearInterval(intervalId);

    const timeoutMs = 15_000;
    const timeout = setTimeout(() => {
      logger.warn({ timeoutMs }, "runner shutdown timeout exceeded; exiting");
      process.exit(1);
    }, timeoutMs);

    const wait = inFlightPromise ?? Promise.resolve();
    wait
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timeout);
        logger.info("runner exited cleanly");
        process.exit(0);
      });
  };

  process.on("SIGTERM", () => beginShutdown("SIGTERM"));
  process.on("SIGINT", () => beginShutdown("SIGINT"));
}

main();
