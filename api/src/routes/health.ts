import { Router } from "express";
import { container } from "../bootstrap/index.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const dbHealth = await container.persistence.healthCheck();
  const dbStatus = dbHealth.connected ? "up" : "down";

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    services: {
      mongo: dbStatus,
      database: dbHealth,
      api: "up"
    }
  });
});
