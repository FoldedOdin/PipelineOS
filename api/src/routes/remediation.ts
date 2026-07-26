import { Router } from "express";
import { requireInternalApiKey } from "../middleware/requireInternalApiKey.js";
import { remediationService } from "../services/remediationService.js";

export const remediationRouter = Router();

// Internal runner endpoints (protected by INTERNAL_API_KEY)
remediationRouter.get(
  "/internal/remediation/rules",
  requireInternalApiKey,
  async (req, res, next) => {
    try {
      const pipelineIdRaw = req.query.pipelineId;
      const pipelineId =
        typeof pipelineIdRaw === "string" && pipelineIdRaw.trim() !== ""
          ? pipelineIdRaw.trim()
          : null;
      const rules = await remediationService.listRules(pipelineId);
      res.status(200).json({ pipelineId, rules });
    } catch (err) {
      next(err);
    }
  },
);

remediationRouter.post(
  "/internal/remediation/rules",
  requireInternalApiKey,
  async (req, res, next) => {
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
  },
);

remediationRouter.post(
  "/internal/remediation/rules/:id/outcomes",
  requireInternalApiKey,
  async (req, res, next) => {
    try {
      const outcomeRaw =
        typeof req.body === "object" && req.body !== null
          ? (req.body as Record<string, unknown>).outcome
          : undefined;
      const outcome =
        outcomeRaw === "attempt" || outcomeRaw === "save" || outcomeRaw === "failure"
          ? outcomeRaw
          : null;
      if (outcome === null) {
        res.status(400).json({ error: "invalid_outcome" });
        return;
      }
      const paramId: unknown = req.params.id;
      const ruleId =
        typeof paramId === "string"
          ? paramId
          : Array.isArray(paramId) && typeof paramId[0] === "string"
            ? paramId[0]
            : "";
      const updated = await remediationService.recordRuleApplication({ ruleId, outcome });
      if (updated === null) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// User-facing dashboard endpoints
remediationRouter.get("/api/remediation/rules", async (req, res, next) => {
  try {
    const pipelineIdRaw = req.query.pipelineId;
    const pipelineId =
      typeof pipelineIdRaw === "string" && pipelineIdRaw.trim() !== ""
        ? pipelineIdRaw.trim()
        : null;
    const rules = await remediationService.listRules(pipelineId);
    res.status(200).json({ pipelineId, rules });
  } catch (err) {
    next(err);
  }
});

remediationRouter.post("/api/remediation/rules", async (req, res, next) => {
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

remediationRouter.delete("/api/remediation/rules/:id", async (req, res, next) => {
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

remediationRouter.post("/api/remediation/rules/:id/outcomes", async (req, res, next) => {
  try {
    const outcomeRaw =
      typeof req.body === "object" && req.body !== null
        ? (req.body as Record<string, unknown>).outcome
        : undefined;
    const outcome =
      outcomeRaw === "attempt" || outcomeRaw === "save" || outcomeRaw === "failure"
        ? outcomeRaw
        : null;
    if (outcome === null) {
      res.status(400).json({ error: "invalid_outcome" });
      return;
    }
    const paramId: unknown = req.params.id;
    const ruleId =
      typeof paramId === "string"
        ? paramId
        : Array.isArray(paramId) && typeof paramId[0] === "string"
          ? paramId[0]
          : "";
    const updated = await remediationService.recordRuleApplication({ ruleId, outcome });
    if (updated === null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});
