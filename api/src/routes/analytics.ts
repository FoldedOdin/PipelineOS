import { Router } from "express";
import { analyticsService } from "../services/analyticsService.js";
import { costService } from "../services/costService.js";
import { flakinessService } from "../services/flakinessService.js";

export const analyticsRouter = Router();

analyticsRouter.get("/api/analytics/flakiness", async (req, res, next) => {
  try {
    const pipelineIdRaw = req.query.pipelineId;
    const pipelineId = typeof pipelineIdRaw === "string" && pipelineIdRaw !== "" ? pipelineIdRaw : null;
    if (pipelineId === null) {
      res.status(400).json({ error: "pipelineId_required" });
      return;
    }
    const scores = await flakinessService.listScoresForPipeline(pipelineId);
    res.status(200).json({ pipelineId, scores });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get("/api/analytics/flakiness-heatmap", async (req, res, next) => {
  try {
    const pipelineIdRaw = req.query.pipelineId;
    const pipelineId = typeof pipelineIdRaw === "string" && pipelineIdRaw !== "" ? pipelineIdRaw : null;
    if (pipelineId === null) {
      res.status(400).json({ error: "pipelineId_required" });
      return;
    }
    const daysRaw = req.query.days;
    const days = typeof daysRaw === "string" ? Number(daysRaw) : 7;
    const heatmap = await flakinessService.getHeatmap(pipelineId, Number.isFinite(days) ? days : 7);
    res.status(200).json({ pipelineId, ...heatmap });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get("/api/analytics/failure-trends", async (req, res, next) => {
  try {
    const daysRaw = req.query.days;
    const days = typeof daysRaw === "string" ? Number(daysRaw) : 14;
    const trend = await analyticsService.getFailureTrends(Number.isFinite(days) ? days : 14);
    res.status(200).json({ days: Number.isFinite(days) ? days : 14, trend });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get("/api/analytics/stage-costs", async (req, res, next) => {
  try {
    const pipelineIdRaw = req.query.pipelineId;
    const pipelineId = typeof pipelineIdRaw === "string" && pipelineIdRaw !== "" ? pipelineIdRaw : null;
    if (pipelineId === null) {
      res.status(400).json({ error: "pipelineId_required" });
      return;
    }
    const limitRaw = req.query.limit;
    const limit = typeof limitRaw === "string" ? Number(limitRaw) : 10;
    const daysRaw = req.query.days;
    const days = typeof daysRaw === "string" ? Number(daysRaw) : 14;
    const topStages = await costService.topStageCosts({
      pipelineId,
      limit: Number.isFinite(limit) ? limit : 10,
      days: Number.isFinite(days) ? days : 14,
    });
    res.status(200).json({ pipelineId, days: Number.isFinite(days) ? days : 14, topStages });
  } catch (err) {
    next(err);
  }
});
