import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  let mongoStatus = "down";
  try {
    if ((mongoose.connection.readyState as unknown as number) === 1) {
      await mongoose.connection.db?.command({ ping: 1 });
      mongoStatus = "up";
    }
  } catch {
    mongoStatus = "down";
  }

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    services: {
      mongo: mongoStatus,
      api: "up"
    }
  });
});
