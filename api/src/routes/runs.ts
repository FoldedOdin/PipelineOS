import { Router } from "express";
import { runService } from "../services/runService.js";

/**
 * Run listing and detail endpoints; handlers added when persistence layer is complete.
 */
export const runsRouter = Router();

void runService;

runsRouter.get("/api/runs", (_req, res) => {
  res.status(501).json({ error: "not_implemented" });
});

runsRouter.get("/api/runs/:id", (_req, res) => {
  res.status(501).json({ error: "not_implemented" });
});

runsRouter.get("/api/runs/:id/stages/:stageName/logs", (_req, res) => {
  res.status(501).json({ error: "not_implemented" });
});
