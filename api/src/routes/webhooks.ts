import { Router } from "express";
import { validateGithubWebhook } from "../middleware/validateWebhook.js";
import { webhookService } from "../services/webhookService.js";

/**
 * GitHub webhook ingress (`POST /api/webhooks/github`).
 * HMAC validation and run enqueueing are implemented in a later milestone.
 */
export const webhooksRouter = Router();

void webhookService;
void validateGithubWebhook;

webhooksRouter.post("/api/webhooks/github", (_req, res) => {
  res.status(501).json({ error: "not_implemented" });
});
