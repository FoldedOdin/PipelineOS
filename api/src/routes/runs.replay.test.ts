import request from "supertest";
import { pino } from "pino";
import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    listRuns: vi.fn(),
    getRunById: vi.fn(),
    getStageLogs: vi.fn(),
    replayRun: vi.fn(),
  };
});

vi.mock("../services/runService.js", () => {
  return { runService: mocks };
});

import { createApp } from "../app.js";

function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

describe("POST /api/runs/:id/replay", () => {
  beforeEach(() => {
    mocks.listRuns.mockReset();
    mocks.getRunById.mockReset();
    mocks.getStageLogs.mockReset();
    mocks.replayRun.mockReset();
  });

  it("queues a replay of an existing run", async () => {
    const replayed = { _id: "new-run", status: "queued", pipelineId: "owner/repo" };
    mocks.replayRun.mockResolvedValue(replayed);
    const app = createApp(createSilentLogger());

    const res = await request(app).post("/api/runs/507f1f77bcf86cd799439011/replay").send({ triggeredBy: "operator" }).expect(202);

    expect(mocks.replayRun).toHaveBeenCalledWith("507f1f77bcf86cd799439011", { triggeredBy: "operator" });
    expect(res.body).toEqual(replayed);
  });

  it("returns 404 when the source run does not exist", async () => {
    mocks.replayRun.mockResolvedValue(null);
    const app = createApp(createSilentLogger());

    await request(app).post("/api/runs/507f1f77bcf86cd799439011/replay").send({}).expect(404);
  });
});
