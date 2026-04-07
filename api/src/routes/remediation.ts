import { Router } from "express";
import { requireInternalApiKey } from "../middleware/requireInternalApiKey.js";
import { remediationService } from "../services/remediationService.js";

export const remediationRouter = Router();

// Phase 3 admin surface is internal-only until user auth exists.
remediationRouter.use("/internal/remediation", requireInternalApiKey);

remediationRouter.get("/internal/remediation/rules", async (req, res, next) => {
  try {
    const pipelineIdRaw = req.query.pipelineId;
    const pipelineId = typeof pipelineIdRaw === "string" && pipelineIdRaw.trim() !== "" ? pipelineIdRaw.trim() : null;
    const rules = await remediationService.listRules(pipelineId);
    res.status(200).json({ pipelineId, rules });
  } catch (err) {
    next(err);
  }
});

remediationRouter.post("/internal/remediation/rules", async (req, res, next) => {
  try {
    const created = await remediationService.createRule(req.body);
    if (created === null) {
      res.status(400).json({ error: "invalid_rule" });
      return;
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

remediationRouter.delete("/internal/remediation/rules/:id", async (req, res, next) => {
  try {
    const ok = await remediationService.deleteRule(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

remediationRouter.post("/internal/remediation/rules/:id/outcomes", async (req, res, next) => {
  try {
    const outcomeRaw = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>).outcome : undefined;
    const outcome = outcomeRaw === "attempt" || outcomeRaw === "save" || outcomeRaw === "failure" ? outcomeRaw : null;
    if (outcome === null) {
      res.status(400).json({ error: "invalid_outcome" });
      return;
    }
    const updated = await remediationService.recordRuleApplication({ ruleId: req.params.id, outcome });
    if (updated === null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

