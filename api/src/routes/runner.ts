import { Router } from "express";
import { requireInternalApiKey } from "../middleware/requireInternalApiKey.js";
import { Pipeline } from "../models/Pipeline.js";
import { runnerService } from "../services/runnerService.js";

export const runnerRouter = Router();

runnerRouter.use("/internal", requireInternalApiKey);

runnerRouter.post("/internal/runs/claim", async (_req, res, next) => {
  try {
    const run = await runnerService.claimNextQueuedRun();
    if (run === null) {
      res.status(204).send();
      return;
    }
    res.status(200).json(run);
  } catch (err) {
    next(err);
  }
});

runnerRouter.post("/internal/runs/:id/status", async (req, res, next) => {
  try {
    const updated = await runnerService.updateRunStatus(req.params.id, req.body);
    if (updated === null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

runnerRouter.post("/internal/runs/:id/stages/:stageName/logs", async (req, res, next) => {
  try {
    const ok = await runnerService.appendStageLogs(req.params.id, req.params.stageName, req.body);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

runnerRouter.put("/internal/runs/:id/stages/:stageName", async (req, res, next) => {
  try {
    const ok = await runnerService.upsertStage(req.params.id, req.params.stageName, req.body);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

runnerRouter.post("/internal/runs/:id/stages/:stageName/status", async (req, res, next) => {
  try {
    const ok = await runnerService.updateStageStatus(req.params.id, req.params.stageName, req.body);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

runnerRouter.get("/internal/pipelines/:pipelineId", async (req, res, next) => {
  try {
    const pipelineId = req.params.pipelineId;
    const doc = await Pipeline.findOne({ pipelineId }).lean().exec();
    if (doc === null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json({ rawYaml: doc.rawYaml, updatedAt: doc.updatedAt });
  } catch (err) {
    next(err);
  }
});

