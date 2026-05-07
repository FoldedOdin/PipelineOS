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

let worker: Worker<GithubWebhookJob> | undefined;

export function startGithubWebhookWorker(logger: Logger): { stop: () => Promise<void> } {
  if (worker) {
    return {
      stop: async () => {
        await worker.close();
      },
    };
  }

  const connection = connectionFromRedisUrl(requiredEnv("REDIS_URL"));
  const queue = createGithubWebhookQueue(connection);

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
      worker = undefined;
      await w?.close();
      await queue.close();
    },
  };
}

