import { Router } from "express";
import fs from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import path from "node:path";
import { requireInternalApiKey } from "../middleware/requireInternalApiKey.js";

export const artifactsRouter = Router();

const DATA_DIR = process.env.DATA_DIR || "/data";
const ARTIFACTS_DIR = path.join(DATA_DIR, "artifacts");
const CACHE_DIR = path.join(DATA_DIR, "cache");

// Ensure dirs exist
Promise.all([
  fs.mkdir(ARTIFACTS_DIR, { recursive: true }).catch(() => {}),
  fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {}),
]).catch(() => {});

// Internal routes for Runner to upload/download
const internalRouter = Router();
internalRouter.use(requireInternalApiKey);

internalRouter.post("/runs/:id/artifacts/:name", (req, res, next) => {
  const { id, name } = req.params;
  const filePath = path.join(ARTIFACTS_DIR, `${id}_${name}.tar.gz`);
  
  const writeStream = createWriteStream(filePath);
  req.pipe(writeStream);
  
  req.on("end", () => {
    res.status(201).json({ success: true, path: filePath });
  });
  
  req.on("error", (err) => {
    next(err);
  });
});

internalRouter.post("/cache/:key", (req, res, next) => {
  const { key } = req.params;
  const filePath = path.join(CACHE_DIR, `${key}.tar.gz`);
  
  const writeStream = createWriteStream(filePath);
  req.pipe(writeStream);
  
  req.on("end", () => {
    res.status(201).json({ success: true, path: filePath });
  });
  
  req.on("error", (err) => {
    next(err);
  });
});

internalRouter.get("/cache/:key", async (req, res, next) => {
  try {
    const { key } = req.params;
    const filePath = path.join(CACHE_DIR, `${key}.tar.gz`);
    
    try {
      await fs.access(filePath);
    } catch {
      res.status(404).json({ error: "Cache not found" });
      return;
    }
    
    res.setHeader("Content-Type", "application/gzip");
    createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

artifactsRouter.use("/internal", internalRouter);

// Public/UI routes to download artifacts (protected by requireAuth globally in app.ts)
artifactsRouter.get("/api/runs/:id/artifacts/:name", async (req, res, next) => {
  try {
    const { id, name } = req.params;
    const filePath = path.join(ARTIFACTS_DIR, `${id}_${name}.tar.gz`);
    
    try {
      await fs.access(filePath);
    } catch {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${id}_${name}.tar.gz"`);
    createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});
