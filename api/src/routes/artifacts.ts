import { Router } from "express";
import path from "node:path";
import { container } from "../bootstrap/index.js";
import { requireInternalApiKey } from "../middleware/requireInternalApiKey.js";

export const artifactsRouter = Router();

// Ensure dirs exist via storage adapter
container.storage.createDirectory("artifacts").catch(() => undefined);
container.storage.createDirectory("cache").catch(() => undefined);

// Internal routes for Runner to upload/download
const internalRouter = Router();
internalRouter.use(requireInternalApiKey);

internalRouter.post("/runs/:id/artifacts/:name", (req, res, next) => {
  const { id, name } = req.params;
  const relativePath = path.join("artifacts", `${id}_${name}.tar.gz`);

  const writeStream = container.storage.createWriteStream(relativePath);
  req.pipe(writeStream);

  req.on("end", () => {
    res.status(201).json({
      success: true,
      path: path.join(container.config.getStorageDirectory(), relativePath),
    });
  });

  req.on("error", (err) => {
    next(err);
  });
});

internalRouter.post("/cache/:key", (req, res, next) => {
  const { key } = req.params;
  const relativePath = path.join("cache", `${key}.tar.gz`);

  const writeStream = container.storage.createWriteStream(relativePath);
  req.pipe(writeStream);

  req.on("end", () => {
    res.status(201).json({
      success: true,
      path: path.join(container.config.getStorageDirectory(), relativePath),
    });
  });

  req.on("error", (err) => {
    next(err);
  });
});

internalRouter.get("/cache/:key", async (req, res, next) => {
  try {
    const { key } = req.params;
    const relativePath = path.join("cache", `${key}.tar.gz`);

    const exists = await container.storage.exists(relativePath);
    if (!exists) {
      res.status(404).json({ error: "Cache not found" });
      return;
    }

    res.setHeader("Content-Type", "application/gzip");
    container.storage.createReadStream(relativePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

artifactsRouter.use("/internal", internalRouter);

// Public/UI routes to download artifacts (protected by requireAuth globally in app.ts)
artifactsRouter.get("/api/runs/:id/artifacts/:name", async (req, res, next) => {
  try {
    const { id, name } = req.params;
    const relativePath = path.join("artifacts", `${id}_${name}.tar.gz`);

    const exists = await container.storage.exists(relativePath);
    if (!exists) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }

    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${id}_${name}.tar.gz"`);
    container.storage.createReadStream(relativePath).pipe(res);
  } catch (err) {
    next(err);
  }
});
