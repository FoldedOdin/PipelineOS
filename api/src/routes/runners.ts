import { Router } from "express";
import { requireInternalApiKey } from "../middleware/requireInternalApiKey.js";
import { runnerService } from "../services/runnerService.js";

export const runnersRouter = Router();

runnersRouter.post("/internal/runners/heartbeat", requireInternalApiKey, async (req, res, next) => {
  try {
    const raw = req.header("x-runner-id");
    const runnerId = raw && raw.trim() !== "" ? raw.trim() : "legacy-runner";
    
    const body = (req.body ?? {}) as Record<string, unknown>;
    const info = {
      version: typeof body.version === "string" ? body.version : undefined,
      hostname: typeof body.hostname === "string" ? body.hostname : undefined,
      platform: typeof body.platform === "string" ? body.platform : undefined,
      activeRuns: typeof body.activeRuns === "number" ? body.activeRuns : undefined,
      maxConcurrentRuns: typeof body.maxConcurrentRuns === "number" ? body.maxConcurrentRuns : undefined,
    };
    await runnerService.registerRunner(runnerId, info);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

runnersRouter.get("/api/runners", async (_req, res, next) => {
  try {
    const runners = await runnerService.listRunners();
    res.status(200).json({ runners });
  } catch (err) {
    next(err);
  }
});
