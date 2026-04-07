import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validateGithubWebhook } from "../middleware/validateWebhook.js";
import { webhookService } from "../services/webhookService.js";

/**
 * GitHub webhook ingress (`POST /api/webhooks/github`).
 * HMAC validation and run enqueueing are implemented in a later milestone.
 */
export const webhooksRouter = Router();

const githubWebhookLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

webhooksRouter.post("/api/webhooks/github", githubWebhookLimiter, validateGithubWebhook, (req, res) => {
  const event = req.header("x-github-event");
  if (event !== "push" && event !== "pull_request") {
    res.status(202).json({ status: "ignored", event: event ?? "unknown" });
    return;
  }

  const deliveryId = req.header("x-github-delivery") ?? undefined;
  webhookService.enqueueGithubEvent({
    event,
    deliveryId,
    body: req.body as unknown,
    logger: req.log,
  });

  // Return quickly to stay within GitHub webhook time limits.
  res.status(202).json({ status: "accepted" });
});
