import { Router } from "express";
import { container } from "../bootstrap/index.js";
import { requireInternalApiKey } from "../middleware/requireInternalApiKey.js";

export const seedRouter = Router();

seedRouter.post("/internal/seed/pipelines", requireInternalApiKey, async (req, res, next) => {
  try {
    const { pipelineId, rawYaml } =
      typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};

    if (typeof pipelineId !== "string" || pipelineId === "" || typeof rawYaml !== "string" || rawYaml === "") {
      res.status(400).json({ error: "invalid_input" });
      return;
    }

    await container.persistence.pipelineRepository.upsertSummaryStats(pipelineId, "seed", rawYaml);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
