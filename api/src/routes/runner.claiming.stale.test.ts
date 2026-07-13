import request from "supertest";
import { pino } from "pino";
import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    claimNextQueuedRun: vi.fn(() => Promise.resolve<Record<string, unknown> | null>(null)),
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

describe("stale run claiming route behavior", () => {
  beforeEach(() => {
    mocks.claimNextQueuedRun.mockClear();
    mocks.heartbeatRun.mockClear();
    process.env.INTERNAL_API_KEY = "internal_test_key";
  });

  it("handles when claim returns null", async () => {
    const app = createApp(createSilentLogger());
    
    // claimNextQueuedRun returning null means no runs are available (even stale ones).
    mocks.claimNextQueuedRun.mockResolvedValueOnce(null);

    await request(app)
      .post("/internal/runs/claim")
      .set("x-internal-api-key", "internal_test_key")
      .set("x-runner-id", "runner-stale-test")
      .expect(204);

    expect(mocks.claimNextQueuedRun).toHaveBeenCalledWith("runner-stale-test");
  });

  it("handles when claim returns a stale run successfully", async () => {
    const app = createApp(createSilentLogger());
    
    // Simulate that a stale run was claimed and returned
    mocks.claimNextQueuedRun.mockResolvedValueOnce({ _id: "stale-run-123", status: "running" });

    const res = await request(app)
      .post("/internal/runs/claim")
      .set("x-internal-api-key", "internal_test_key")
      .set("x-runner-id", "runner-stale-test")
      .expect(200);

    expect(res.body).toEqual({ _id: "stale-run-123", status: "running" });
    expect(mocks.claimNextQueuedRun).toHaveBeenCalledWith("runner-stale-test");
  });
});
