import { Router } from "express";
import { container } from "../bootstrap/index.js";

export const secretsRouter = Router();

secretsRouter.get("/api/secrets", async (_req, res, next) => {
  try {
    const secrets = await container.secrets.listPublic();
    res.json(secrets);
  } catch (err) {
    next(err);
  }
});

secretsRouter.post("/api/secrets", async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { name, value } = body;
    if (typeof name !== "string" || typeof value !== "string") {
      res.status(400).json({ error: "Name and value are required" });
      return;
    }
    const secret = await container.secrets.upsert(name, value);
    res.status(201).json({
      id: secret.id,
      name: secret.name,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

secretsRouter.delete("/api/secrets/:id", async (req, res, next) => {
  try {
    const success = await container.secrets.delete(req.params.id);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: "Secret not found" });
    }
  } catch (err) {
    next(err);
  }
});
