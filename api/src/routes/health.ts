import { Router } from "express";
import { container } from "../bootstrap/index.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const isHealthy = await container.persistence.healthCheck();
  const dbStatus = isHealthy ? "up" : "down";

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    services: {
      mongo: dbStatus,
      api: "up"
    }
  });
});
