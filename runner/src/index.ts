import "dotenv/config";
import { pino } from "pino";
import type { Logger } from "pino";
import { executeQueuedRun } from "./executor.js";
import { validateRunnerConfig } from "./config.js";

function createRunnerLogger(): Logger {
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
  // MAX_CONCURRENT_RUNS is an optimization to control parallelism within this single runner instance.
  // The actual distributed concurrency lock is maintained by MongoDB via claimNextQueuedRun's atomic findOneAndUpdate.
  const maxConcurrentRuns = Number(process.env.MAX_CONCURRENT_RUNS) || 1;
  const inFlightPromises = new Set<Promise<void>>();
  let shuttingDown = false;

  const intervalId = setInterval(() => {
    if (shuttingDown) return;

    // Send the runner idle heartbeat ping.
    void import("./executor.js").then(({ pingRunnerHeartbeat }) => {
      void pingRunnerHeartbeat(logger);
    });

    if (inFlightPromises.size >= maxConcurrentRuns) return;

    const promise: Promise<void> = executeQueuedRun(logger)
      .catch((err: unknown) => {
        logger.error({ err }, "runner loop iteration failed");
      })
      .finally(() => {
        inFlightPromises.delete(promise);
      });
    
    inFlightPromises.add(promise);
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

    const wait = Promise.allSettled(Array.from(inFlightPromises));
    wait
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timeout);
        logger.info("runner exited cleanly");
        process.exit(0);
      });
  };

  process.on("SIGTERM", () => {
    beginShutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    beginShutdown("SIGINT");
  });
}

main();
