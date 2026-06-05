import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  let mongoStatus = "down";
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db?.command({ ping: 1 });
      mongoStatus = "up";
    }
  } catch (err) {
    mongoStatus = "down";
  }

  res.status(mongoStatus === "up" ? 200 : 503).json({
    status: mongoStatus === "up" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    services: {
      mongo: mongoStatus,
      api: "up"
    }
  });
});
