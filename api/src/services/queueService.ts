import PQueue from "p-queue";

let queue: PQueue | undefined;

/**
 * Shared in-process queue for webhook-triggered work (p-queue).
 * Concurrency is intentionally conservative to keep MongoDB updates ordered per run.
 */
export function getWebhookQueue(): PQueue {
  queue ??= new PQueue({ concurrency: 1 });
  return queue;
}
