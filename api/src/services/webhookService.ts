/**
 * Translates validated GitHub webhook payloads into queued runs.
 * Full implementation ships with the webhook route milestone.
 */
import type { Logger } from "pino";
import { container } from "../bootstrap/index.js";

type GithubEventName = "push" | "pull_request";

type GithubWebhookBody = unknown;

function parseBranchFromRef(ref: unknown): string | null {
  if (typeof ref !== "string" || ref === "") return null;
  const prefix = "refs/heads/";
  if (ref.startsWith(prefix)) return ref.slice(prefix.length);
  return ref;
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function getNested(body: unknown, path: string[]): unknown {
  let cur: unknown = body;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function getNestedString(body: unknown, path: string[]): string | null {
  return requiredString(getNested(body, path));
}

export async function processGithubWebhookEvent(input: {
  event: GithubEventName;
  deliveryId: string | undefined;
  body: GithubWebhookBody;
  logger: Logger;
}): Promise<void> {
  const { event, deliveryId, body, logger } = input;

  const pipelineId = getNestedString(body, ["repository", "full_name"]) ?? "unknown/unknown";
  const triggeredBy = getNestedString(body, ["sender", "login"]) ?? "unknown";

  let commitSha: string | null = null;
  let branch: string | null = null;

  if (event === "push") {
    commitSha = getNestedString(body, ["after"]);
    branch = parseBranchFromRef(getNested(body, ["ref"]));
  } else {
    commitSha = getNestedString(body, ["pull_request", "head", "sha"]);
    branch = getNestedString(body, ["pull_request", "head", "ref"]);
  }

  if (commitSha === null || branch === null) {
    logger.warn({ event, pipelineId }, "webhook missing required fields; run not created");
    return;
  }

  if (deliveryId !== undefined && deliveryId !== "") {
    const recorded = await container.persistence.webhookDeliveryRepository.recordDelivery({
      deliveryId,
      event,
      pipelineId,
    });
    if (!recorded) {
      logger.info({ deliveryId, event, pipelineId }, "duplicate webhook delivery ignored");
      return;
    }
  } else {
    logger.warn({ event, pipelineId }, "missing x-github-delivery header; webhook is not idempotent");
  }

  const run = await container.persistence.runRepository.create({
    pipelineId,
    commitSha,
    branch,
    triggeredBy,
    event,
    status: "queued",
    stages: [],
  });

  logger.info({ runId: run.id, pipelineId, event, eventName: "webhook_received", deliveryId }, "queued run created from webhook");
}

export const webhookService = {
  enqueueGithubEvent(input: { event: GithubEventName; deliveryId: string | undefined; body: GithubWebhookBody; logger: Logger }): void {
    // Backwards-compatible wrapper (unused once webhook route enqueues BullMQ jobs).
    void processGithubWebhookEvent(input).catch(() => undefined);
  },
} as const;
