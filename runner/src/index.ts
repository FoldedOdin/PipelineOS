import "./telemetry.js";
import "dotenv/config";
import { pino } from "pino";
import type { Logger } from "pino";
import { executeQueuedRun, pingRunnerHeartbeat, killAllActiveContainers } from "./executor.js";
import { validateRunnerConfig } from "./config.js";

function createRunnerLogger(): Logger {
  return pino({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  });
}

const logger = createRunnerLogger();

async function main(): Promise<void> {
  validateRunnerConfig(logger);

  const intervalMs = 2000;
  const maxConcurrentRuns = Number(process.env.MAX_CONCURRENT_RUNS) || 1;
  const inFlightPromises = new Set<Promise<void>>();
  let shuttingDown = false;

  // Register runner with the Control Plane immediately on startup
  // so it appears in the runner list before the first polling tick.
  await pingRunnerHeartbeat(logger, 0, maxConcurrentRuns);
  logger.info({ intervalMs, maxConcurrentRuns }, "runner started; polling loop active");

  const intervalId = setInterval(() => {
    if (shuttingDown) return;

    // Keep registration fresh on every tick.
    void pingRunnerHeartbeat(logger, inFlightPromises.size, maxConcurrentRuns);

    if (inFlightPromises.size >= maxConcurrentRuns) return;

    const promise: Promise<void> = executeQueuedRun(logger)
      .catch((err: unknown) => {
        logger.error({ err }, "runner loop iteration failed");
      })
      .finally(() => {
        inFlightPromises.delete(promise);
      });

    inFlightPromises.add(promise);
  }, intervalMs);

  const beginShutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "runner shutting down — stopping in-flight containers");
    clearInterval(intervalId);

    const timeoutMs = 30_000;
    const timeout = setTimeout(() => {
      logger.warn({ timeoutMs }, "runner shutdown timeout exceeded; exiting");
      process.exit(1);
    }, timeoutMs);

    // Kill all active Docker containers before waiting for promises to settle.
    void killAllActiveContainers(logger)
      .catch(() => undefined)
      .finally(() => {
        void Promise.allSettled(Array.from(inFlightPromises))
          .catch(() => undefined)
          .finally(() => {
            clearTimeout(timeout);
            logger.info("runner exited cleanly");
            process.exit(0);
          });
      });
  };

  process.on("SIGTERM", () => beginShutdown("SIGTERM"));
  process.on("SIGINT", () => beginShutdown("SIGINT"));
}

void main().catch((err: unknown) => {
  // Config validation or startup errors — exit immediately.
  pino().error({ err }, "runner startup failed");
  process.exit(1);
});
