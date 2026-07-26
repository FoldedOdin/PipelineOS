import request from "supertest";
import { pino } from "pino";
import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    claimNextQueuedRun: vi.fn(() => Promise.resolve(null)),
    heartbeatRun: vi.fn(() => Promise.resolve(true)),
  };
});

vi.mock("../services/runnerService.js", () => {
  return {
    runnerService: {
      claimNextQueuedRun: mocks.claimNextQueuedRun,
      heartbeatRun: mocks.heartbeatRun,
    },
  };
});

import { createApp } from "../app.js";

function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

describe("internal runner claiming", () => {
  beforeEach(() => {
    mocks.claimNextQueuedRun.mockClear();
    mocks.heartbeatRun.mockClear();
    process.env.INTERNAL_API_KEY = "internal_test_key";
  });

  it("passes x-runner-id to claimNextQueuedRun", async () => {
    const app = createApp(createSilentLogger());
    await request(app)
      .post("/internal/runs/claim")
      .set("x-internal-api-key", "internal_test_key")
      .set("x-runner-id", "runner-a")
      .expect(204);

    expect(mocks.claimNextQueuedRun).toHaveBeenCalledWith("runner-a");
  });

  it("falls back to legacy runner id when missing x-runner-id", async () => {
    const app = createApp(createSilentLogger());
    await request(app)
      .post("/internal/runs/claim")
      .set("x-internal-api-key", "internal_test_key")
      .expect(204);

    expect(mocks.claimNextQueuedRun).toHaveBeenCalledWith("legacy-runner");
  });

  it("passes x-runner-id to heartbeatRun", async () => {
    const app = createApp(createSilentLogger());
    await request(app)
      .post("/internal/runs/abc123/heartbeat")
      .set("x-internal-api-key", "internal_test_key")
      .set("x-runner-id", "runner-a")
      .expect(204);

    expect(mocks.heartbeatRun).toHaveBeenCalledWith("abc123", "runner-a");
  });
});
