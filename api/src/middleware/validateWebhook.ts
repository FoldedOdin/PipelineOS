import type { RequestHandler } from "express";
import crypto from "node:crypto";

/**
 * Validates `x-hub-signature-256` for GitHub webhooks using `GITHUB_WEBHOOK_SECRET`.
 * Implemented alongside the webhook service in a later milestone.
 */
type RequestWithRawBody = Parameters<RequestHandler>[0] & { rawBody?: Buffer };

function safeTimingEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const validateGithubWebhook: RequestHandler = (req, res, next) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret === undefined || secret === "" || secret.startsWith("CHANGE_ME")) {
    res.status(500).json({ error: "webhook_secret_not_configured" });
    return;
  }

  const signatureHeader = req.header("x-hub-signature-256");
  if (signatureHeader === undefined || !signatureHeader.startsWith("sha256=")) {
    res.status(401).json({ error: "missing_signature" });
    return;
  }

  const rawBody = (req as RequestWithRawBody).rawBody;
  if (rawBody === undefined) {
    res.status(400).json({ error: "missing_raw_body" });
    return;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedHeader = `sha256=${expected}`;

  const expectedBuf = Buffer.from(expectedHeader, "utf8");
  const providedBuf = Buffer.from(signatureHeader, "utf8");

  if (!safeTimingEqual(expectedBuf, providedBuf)) {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  next();
};
