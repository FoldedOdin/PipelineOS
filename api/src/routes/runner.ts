import { Router } from "express";
import { requireInternalApiKey } from "../middleware/requireInternalApiKey.js";
import { fetchPipelineYamlFromGithub, isGithubAppConfigured } from "../services/githubPipelineService.js";
import { runnerService } from "../services/runnerService.js";
import { diagnosisService } from "../services/diagnosisService.js";
import { container } from "../bootstrap/index.js";
import { decryptSecret } from "../services/cryptoService.js";

export const runnerRouter = Router();

runnerRouter.use("/internal", requireInternalApiKey);

runnerRouter.get("/internal/secrets", async (_req, res, next) => {
  try {
    const all = await container.secrets.listPublic();
    const result: Record<string, string> = {};
    for (const s of all) {
      const enc = await container.secrets.getEncrypted(s.id);
      if (enc) {
        try {
          result[s.name] = decryptSecret(enc.encryptedValue);
        } catch {
          // ignore
        }
      }
    }
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

function readRunnerId(req: { header: (name: string) => string | undefined }, logger: { warn: (o: unknown, msg: string) => void }): string {
  const raw = req.header("x-runner-id");
  if (raw && raw.trim() !== "") return raw.trim();
  logger.warn({}, "missing x-runner-id header; using legacy runner id");
  return "legacy-runner";
}

runnerRouter.post("/internal/runs/claim", async (req, res, next) => {
  try {
    const runnerId = readRunnerId(req, req.log);
    const run = await runnerService.claimNextQueuedRun(runnerId);
    if (run === null) {
      res.status(204).send();
      return;
    }
    req.log.info({ runId: String(run._id ?? run.id), runnerId, eventName: "run_claimed" }, "run claimed");
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
    const bodyStatus = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>).status : "unknown";
    req.log.info({ runId: req.params.id, status: bodyStatus, eventName: "run_status_changed" }, "run status changed");
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
    const bodyStatus = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>).status : "unknown";
    req.log.info({ runId: req.params.id, stageName: req.params.stageName, status: bodyStatus, eventName: "stage_status_changed" }, "stage status changed");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

runnerRouter.post("/internal/runs/:id/stages/:stageName/metrics", async (req, res, next) => {
  try {
    const ok = await runnerService.updateStageMetrics(req.params.id, req.params.stageName, req.body);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

runnerRouter.post("/internal/runs/:id/heartbeat", async (req, res, next) => {
  try {
    const runnerId = readRunnerId(req, req.log);
    const ok = await runnerService.heartbeatRun(req.params.id, runnerId);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    req.log.info({ runId: req.params.id, runnerId, eventName: "run_heartbeat" }, "run heartbeat");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

runnerRouter.get("/internal/runs/:id/stages/:stageName/diagnosis", async (req, res, next) => {
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

runnerRouter.get("/internal/pipelines/:pipelineId", async (req, res, next) => {
  try {
    const pipelineId = req.params.pipelineId;
    const ref = typeof req.query.ref === "string" && req.query.ref !== "" ? req.query.ref : null;
    if (ref === null) {
      res.status(400).json({ error: "missing_ref" });
      return;
    }

    const cached = await container.persistence.pipelineRepository.findById(pipelineId);
    if (cached !== null && cached.refSha === ref) {
      res.status(200).json({ rawYaml: cached.rawYaml, updatedAt: cached.updatedAt, refSha: cached.refSha, source: "cache" });
      return;
    }

    if (!isGithubAppConfigured()) {
      res.status(501).json({ error: "github_app_not_configured" });
      return;
    }

    const rawYaml = await fetchPipelineYamlFromGithub({ pipelineId, refSha: ref, logger: req.log });
    await container.persistence.pipelineRepository.upsertSummaryStats(pipelineId, ref, rawYaml);

    res.status(200).json({ rawYaml, updatedAt: new Date().toISOString(), refSha: ref, source: "github" });
  } catch (err) {
    next(err);
  }
});

runnerRouter.post("/internal/runs/:id/stages/:stageName/artifacts/:fileName", async (req, res, next) => {
  try {
    const run = await container.persistence.runRepository.findById(req.params.id);
    if (!run) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    
    await container.artifactStorage.uploadArtifact(
      run.pipelineId,
      req.params.id,
      req.params.stageName,
      req.params.fileName,
      req
    );
    
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

