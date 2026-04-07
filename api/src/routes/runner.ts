import { Router } from "express";
import { requireInternalApiKey } from "../middleware/requireInternalApiKey.js";
import { Pipeline } from "../models/Pipeline.js";
import { fetchPipelineYamlFromGithub, isGithubAppConfigured } from "../services/githubPipelineService.js";
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
    const ref = typeof req.query.ref === "string" && req.query.ref !== "" ? req.query.ref : null;
    if (ref === null) {
      res.status(400).json({ error: "missing_ref" });
      return;
    }

    const cached = await Pipeline.findOne({ pipelineId }).lean().exec();
    if (cached !== null && cached.refSha === ref) {
      res.status(200).json({ rawYaml: cached.rawYaml, updatedAt: cached.updatedAt, refSha: cached.refSha, source: "cache" });
      return;
    }

    if (!isGithubAppConfigured()) {
      res.status(501).json({ error: "github_app_not_configured" });
      return;
    }

    const rawYaml = await fetchPipelineYamlFromGithub({ pipelineId, refSha: ref, logger: req.log });
    await Pipeline.findOneAndUpdate(
      { pipelineId },
      { $set: { pipelineId, refSha: ref, rawYaml, updatedAt: new Date() } },
      { upsert: true },
    ).exec();

    res.status(200).json({ rawYaml, updatedAt: new Date().toISOString(), refSha: ref, source: "github" });
  } catch (err) {
    next(err);
  }
});

