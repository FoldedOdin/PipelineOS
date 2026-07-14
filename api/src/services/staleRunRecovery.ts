import type { Logger } from "pino";
import { container } from "../bootstrap/index.js";
import type { StageDTO } from "../domain/dto/index.js";

function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

/**
 * Marks runs as failed if they were claimed but have not heartbeated recently.
 * This prevents "zombie" runs when a runner crashes mid-execution.
 */
export function startStaleRunRecovery(logger: Logger): { stop: () => void } {
  const checkEveryMs = minutesToMs(1);
  const staleAfterMs = minutesToMs(5);

  const tick = async (): Promise<void> => {
    const staleBefore = new Date(Date.now() - staleAfterMs);

    const candidates = await container.persistence.runRepository.findStaleRuns(staleBefore, 25);

    if (candidates.length === 0) return;

    for (const run of candidates) {
      const now = new Date();
      const updatedStages: StageDTO[] = run.stages.map((stage) => {
        if (stage.status === "running" || stage.status === "pending") {
          return {
            ...stage,
            status: "failed",
            finishedAt: now,
          };
        }
        return stage;
      });

      await container.persistence.runRepository.update(run.id, {
        status: "failed",
        finishedAt: now,
        stages: updatedStages,
      });

      logger.warn({ runId: run.id, eventName: "stale_run_recovered" }, "marked stale run as failed");
    }
  };

  const interval = setInterval(() => {
    void tick().catch((err: unknown) => {
      logger.error({ err }, "stale run recovery tick failed");
    });
  }, checkEveryMs);

  logger.info({ checkEveryMs, staleAfterMs }, "stale run recovery enabled");

  return {
    stop: () => {
      clearInterval(interval);
    },
  };
}
