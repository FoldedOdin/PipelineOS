import { Router } from "express";
import { validateGithubWebhook } from "../middleware/validateWebhook.js";
import { webhookService } from "../services/webhookService.js";

/**
 * GitHub webhook ingress (`POST /api/webhooks/github`).
 * HMAC validation and run enqueueing are implemented in a later milestone.
 */
export const webhooksRouter = Router();

webhooksRouter.post("/api/webhooks/github", validateGithubWebhook, (req, res) => {
  const event = req.header("x-github-event");
  if (event !== "push" && event !== "pull_request") {
    res.status(202).json({ status: "ignored", event: event ?? "unknown" });
    return;
  }

  webhookService.enqueueGithubEvent({
    event,
    body: req.body,
    logger: req.log,
  });

  // Return quickly to stay within GitHub webhook time limits.
  res.status(202).json({ status: "accepted" });
});
