import crypto from "node:crypto";
import request from "supertest";
import { pino } from "pino";
import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    enqueueGithubWebhookJob: vi.fn(() => Promise.resolve(undefined)),
  };
});

vi.mock("../services/jobQueue.js", () => {
  return { enqueueGithubWebhookJob: mocks.enqueueGithubWebhookJob };
});

import { createApp } from "../app.js";

function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

function signBody(secret: string, body: Buffer): string {
  const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hex}`;
}

describe("POST /api/webhooks/github", () => {
  beforeEach(() => {
    mocks.enqueueGithubWebhookJob.mockClear();
    process.env.GITHUB_WEBHOOK_SECRET = "test_secret";
  });

  it("enqueues a BullMQ job and returns 202", async () => {
    const app = createApp(createSilentLogger());
    const payload = { repository: { full_name: "owner/repo" }, sender: { login: "me" } };
    const raw = Buffer.from(JSON.stringify(payload), "utf8");

    const res = await request(app)
      .post("/api/webhooks/github")
      .set("content-type", "application/json")
      .set("x-github-event", "push")
      .set("x-github-delivery", "delivery-1")
      .set("x-hub-signature-256", signBody("test_secret", raw))
      .send(payload);

    expect(res.status).toBe(202);
    expect(mocks.enqueueGithubWebhookJob).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueGithubWebhookJob).toHaveBeenCalledWith({
      event: "push",
      deliveryId: "delivery-1",
      body: payload,
    });
  });

  it("ignores unsupported events", async () => {
    const app = createApp(createSilentLogger());
    const payload = { ok: true };
    const raw = Buffer.from(JSON.stringify(payload), "utf8");

    const res = await request(app)
      .post("/api/webhooks/github")
      .set("content-type", "application/json")
      .set("x-github-event", "ping")
      .set("x-github-delivery", "delivery-2")
      .set("x-hub-signature-256", signBody("test_secret", raw))
      .send(payload);

    expect(res.status).toBe(202);
    expect(mocks.enqueueGithubWebhookJob).not.toHaveBeenCalled();
  });
});
