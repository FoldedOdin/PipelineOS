import request from "supertest";
import { pino } from "pino";
import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getFailureTrends: vi.fn(() => Promise.resolve([])),
    topStageCosts: vi.fn(() => Promise.resolve([])),
    listScoresForPipeline: vi.fn(() => Promise.resolve([])),
    getHeatmap: vi.fn(() => Promise.resolve({ days: [], stages: [] })),
  };
});

vi.mock("../services/analyticsService.js", () => {
  return { analyticsService: { getFailureTrends: mocks.getFailureTrends } };
});

vi.mock("../services/costService.js", () => {
  return { costService: { topStageCosts: mocks.topStageCosts } };
});

vi.mock("../services/flakinessService.js", () => {
  return {
    flakinessService: {
      listScoresForPipeline: mocks.listScoresForPipeline,
      getHeatmap: mocks.getHeatmap,
    },
  };
});

import { createApp } from "../app.js";

function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

describe("analytics routes", () => {
  beforeEach(() => {
    mocks.getFailureTrends.mockClear();
    mocks.topStageCosts.mockClear();
    mocks.listScoresForPipeline.mockClear();
    mocks.getHeatmap.mockClear();
  });

  it("requires pipelineId for flakiness scores", async () => {
    const app = createApp(createSilentLogger());

    await request(app).get("/api/analytics/flakiness").expect(400);
  });

  it("bounds invalid failure trend days to the default", async () => {
    const app = createApp(createSilentLogger());

    await request(app).get("/api/analytics/failure-trends?days=not-a-number").expect(200);

    expect(mocks.getFailureTrends).toHaveBeenCalledWith(14);
  });

  it("passes stage cost filters through to the service", async () => {
    const app = createApp(createSilentLogger());

    await request(app).get("/api/analytics/stage-costs?pipelineId=owner/repo&days=3&limit=5").expect(200);

    expect(mocks.topStageCosts).toHaveBeenCalledWith({
      pipelineId: "owner/repo",
      days: 3,
      limit: 5,
    });
  });
});
