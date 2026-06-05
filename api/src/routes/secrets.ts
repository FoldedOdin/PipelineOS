import { Router } from "express";
import { secretModel } from "../models/Secret.js";

export const secretsRouter = Router();

secretsRouter.get("/api/secrets", (req, res) => {
  const secrets = secretModel.listSecrets();
  res.json(secrets);
});

secretsRouter.post("/api/secrets", (req, res) => {
  const { name, value } = req.body;
  if (typeof name !== "string" || typeof value !== "string") {
    res.status(400).json({ error: "Name and value are required" });
    return;
  }
  const secret = secretModel.createSecret(name, value);
  res.status(201).json({
    id: secret.id,
    name: secret.name,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
  });
});

secretsRouter.delete("/api/secrets/:id", (req, res) => {
  const success = secretModel.deleteSecret(req.params.id);
  if (success) {
    res.status(204).send();
  } else {
    res.status(404).json({ error: "Secret not found" });
  }
});
