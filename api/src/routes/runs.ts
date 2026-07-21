import { Router } from "express";
import { diagnosisService } from "../services/diagnosisService.js";
import { runService } from "../services/runService.js";
import { handleSseStream } from "../ws/logStream.js";

/**
 * Run listing and detail endpoints; handlers added when persistence layer is complete.
 */
export const runsRouter = Router();

runsRouter.get("/api/runs", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? "1");
    const limit = Number(req.query.limit ?? "20");
    const data = await runService.listRuns({ page, limit });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

runsRouter.get("/api/runs/:id", async (req, res, next) => {
  try {
    const run = await runService.getRunById(req.params.id);
    if (run === null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json(run);
  } catch (err) {
    next(err);
  }
});

/**
 * SSE live stream for a run. Browser clients subscribe with:
 *   const evtSrc = new EventSource('/api/runs/:id/stream');
 */
runsRouter.get("/api/runs/:id/stream", handleSseStream);

runsRouter.post("/api/runs/:id/replay", async (req, res, next) => {
  try {
    const body = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
    const triggeredBy = typeof body.triggeredBy === "string" ? body.triggeredBy : undefined;
    const replay = await runService.replayRun(req.params.id, { triggeredBy });
    if (replay === null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(202).json(replay);
  } catch (err) {
    next(err);
  }
});

runsRouter.get("/api/runs/:id/stages/:stageName/logs", async (req, res, next) => {
  try {
    const logs = await runService.getStageLogs(req.params.id, req.params.stageName);
    if (logs === null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json({ logs });
  } catch (err) {
    next(err);
  }
});

runsRouter.get("/api/runs/:id/stages/:stageName/diagnosis", async (req, res, next) => {
  try {
    const result = await diagnosisService.diagnoseStage(req.params.id, req.params.stageName);
    if (result === null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
