import { Queue, Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { Logger } from "pino";
import { processGithubWebhookEvent } from "./webhookService.js";

type GithubEventName = "push" | "pull_request";

export interface GithubWebhookJob {
  event: GithubEventName;
  deliveryId?: string;
  body: unknown;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

export const githubWebhookQueueName = "github-webhooks";

let queue: Queue<GithubWebhookJob> | undefined;

function connectionFromRedisUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const port = url.port ? Number(url.port) : 6379;
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("REDIS_URL port is invalid");
  }

  const base: ConnectionOptions = {
    host: url.hostname,
    port,
  };

  if (url.password) {
    base.password = url.password;
  }

  if (url.protocol === "rediss:") {
    base.tls = {};
  }

  return base;
}

export function createGithubWebhookQueue(connection: ConnectionOptions): Queue<GithubWebhookJob> {
  return new Queue<GithubWebhookJob>(githubWebhookQueueName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { age: 60 * 60, count: 1000 },
      removeOnFail: { age: 24 * 60 * 60, count: 5000 },
    },
  });
}

function getGithubWebhookQueue(): Queue<GithubWebhookJob> {
  queue ??= createGithubWebhookQueue(connectionFromRedisUrl(requiredEnv("REDIS_URL")));
  return queue;
}

export async function enqueueGithubWebhookJob(input: GithubWebhookJob): Promise<void> {
  const q = getGithubWebhookQueue();
  const jobId = input.deliveryId && input.deliveryId !== "" ? input.deliveryId : undefined;
  await q.add("github", input, { jobId });
}

let worker: Worker<GithubWebhookJob> | undefined;

export function startGithubWebhookWorker(logger: Logger): { stop: () => Promise<void> } {
  if (worker) {
    const runningWorker = worker;
    return {
      stop: async () => {
        await runningWorker.close();
      },
    };
  }

  const connection = connectionFromRedisUrl(requiredEnv("REDIS_URL"));
  queue ??= createGithubWebhookQueue(connection);

  worker = new Worker<GithubWebhookJob>(
    githubWebhookQueueName,
    async (job) => {
      await processGithubWebhookEvent({
        event: job.data.event,
        deliveryId: job.data.deliveryId,
        body: job.data.body,
        logger,
      });
    },
    { connection },
  );

  worker.on("error", (err) => {
    logger.error({ err }, "github webhook worker error");
  });

  worker.on("failed", (job, err) => {
    logger.warn({ err, jobId: job?.id }, "github webhook job failed");
  });

  logger.info({ queue: queue.name }, "github webhook worker started");

  return {
    stop: async () => {
      const w = worker;
      const q = queue;
      worker = undefined;
      await w?.close();
      await q?.close();
      queue = undefined;
    },
  };
}
