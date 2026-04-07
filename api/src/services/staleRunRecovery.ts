import type { Logger } from "pino";
import { Run } from "../models/Run.js";

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

    const candidates = await Run.find({
      status: "running",
      startedAt: { $ne: null, $lte: staleBefore },
      $or: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { $lte: staleBefore } }],
    })
      .limit(25)
      .exec();

    if (candidates.length === 0) return;

    for (const run of candidates) {
      run.status = "failed";
      run.finishedAt = new Date();

      const stages = run.stages as unknown as { status?: string; finishedAt?: Date | null }[];
      for (const stage of stages) {
        if (stage.status === "running" || stage.status === "pending") {
          stage.status = "failed";
          stage.finishedAt = new Date();
        }
      }

      await run.save();
      logger.warn({ runId: run._id.toString() }, "marked stale run as failed");
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

