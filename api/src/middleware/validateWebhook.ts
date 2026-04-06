import type { RequestHandler } from "express";

/**
 * Validates `x-hub-signature-256` for GitHub webhooks using `GITHUB_WEBHOOK_SECRET`.
 * Implemented alongside the webhook service in a later milestone.
 */
export const validateGithubWebhook: RequestHandler = (_req, res) => {
  res.status(501).json({ error: "not_implemented" });
};
