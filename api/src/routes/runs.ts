import { Router } from "express";
import { runService } from "../services/runService.js";

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
