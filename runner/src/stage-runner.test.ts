/**
 * Tests for stage-runner.ts
 *
 * Strategy: mock api-client and container-runner; verify that runStage
 * drives the correct lifecycle through each scenario.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PipelineStage } from "./types.js";

const baseStage: PipelineStage = {
  name: "build",
  image: "node:20-alpine",
  run: "npm test",
  depends_on: [],
  env: {},
  timeout_minutes: null,
};

const noLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: () => noLogger,
} as never;

beforeEach(() => {
  vi.resetModules();
});

describe("runStage — success path", () => {
  it("sets status running then success on exit code 0", async () => {
    const setStageStatus = vi.fn().mockResolvedValue(undefined);
    const upsertStage = vi.fn().mockResolvedValue(undefined);

    vi.doMock("./api-client.js", () => ({
      upsertStage,
      setStageStatus,
      appendLogs: vi.fn().mockResolvedValue(undefined),
      postStageMetrics: vi.fn().mockResolvedValue(undefined),
      fetchDiagnosis: vi.fn().mockResolvedValue(null),
      recordRuleOutcome: vi.fn(),
      uploadArtifacts: vi.fn(),
      uploadCache: vi.fn(),
      downloadCache: vi.fn(),
    }));
    vi.doMock("./container-runner.js", () => ({
      runContainer: vi.fn().mockResolvedValue({
        statusCode: 0,
        cpuSeconds: 1.2,
        cpuPercentAvg: 10,
        cpuPercentMax: 20,
        memBytesMax: 1024,
        memBytesAvg: 512,
      }),
      StageTimeoutError: class StageTimeoutError extends Error {},
    }));
    vi.doMock("./config.js", () => ({ getDefaultTimeoutMs: () => null, getRunnerId: () => "runner-123" }));

    const { runStage } = await import("./stage-runner.js");
    await runStage(noLogger, "run-1", baseStage, [], "pipe-1", null, {});

    expect(setStageStatus).toHaveBeenCalledWith("run-1", "build", "running");
    expect(setStageStatus).toHaveBeenCalledWith("run-1", "build", "success", 0);
  });
});

describe("runStage — failure path (no retry rules)", () => {
  it("sets status failed and throws on non-zero exit code", async () => {
    const setStageStatus = vi.fn().mockResolvedValue(undefined);

    vi.doMock("./api-client.js", () => ({
      upsertStage: vi.fn().mockResolvedValue(undefined),
      setStageStatus,
      appendLogs: vi.fn().mockResolvedValue(undefined),
      postStageMetrics: vi.fn().mockResolvedValue(undefined),
      fetchDiagnosis: vi.fn().mockResolvedValue(null),
      recordRuleOutcome: vi.fn(),
      uploadArtifacts: vi.fn(),
      uploadCache: vi.fn(),
      downloadCache: vi.fn(),
    }));
    vi.doMock("./container-runner.js", () => ({
      runContainer: vi.fn().mockResolvedValue({
        statusCode: 1,
        cpuSeconds: null,
        cpuPercentAvg: null,
        cpuPercentMax: null,
        memBytesMax: null,
        memBytesAvg: null,
      }),
      StageTimeoutError: class StageTimeoutError extends Error {},
    }));
    vi.doMock("./config.js", () => ({ getDefaultTimeoutMs: () => null, getRunnerId: () => "runner-123" }));

    const { runStage } = await import("./stage-runner.js");

    await expect(
      runStage(noLogger, "run-2", baseStage, [], "pipe-1", null, {}),
    ).rejects.toThrow("failed with exit code 1");

    expect(setStageStatus).toHaveBeenCalledWith("run-2", "build", "failed", 1);
  });
});

describe("runStage — retry until success", () => {
  it("retries on failure and marks success when retry succeeds", async () => {
    const setStageStatus = vi.fn().mockResolvedValue(undefined);
    const recordRuleOutcome = vi.fn().mockResolvedValue(undefined);
    let callCount = 0;

    vi.doMock("./api-client.js", () => ({
      upsertStage: vi.fn().mockResolvedValue(undefined),
      setStageStatus,
      appendLogs: vi.fn().mockResolvedValue(undefined),
      postStageMetrics: vi.fn().mockResolvedValue(undefined),
      fetchDiagnosis: vi.fn().mockResolvedValue(null),
      recordRuleOutcome,
      uploadArtifacts: vi.fn(),
      uploadCache: vi.fn(),
      downloadCache: vi.fn(),
    }));
    vi.doMock("./container-runner.js", () => ({
      runContainer: vi.fn().mockImplementation(async () => {
        callCount += 1;
        return {
          statusCode: callCount < 2 ? 1 : 0, // fail first time, succeed second
          cpuSeconds: null,
          cpuPercentAvg: null,
          cpuPercentMax: null,
          memBytesMax: null,
          memBytesAvg: null,
        };
      }),
      StageTimeoutError: class StageTimeoutError extends Error {},
    }));
    vi.doMock("./config.js", () => ({ getDefaultTimeoutMs: () => null, getRunnerId: () => "runner-123" }));

    const { runStage } = await import("./stage-runner.js");

    const retryRule = {
      id: "rule-1",
      enabled: true,
      name: "retry",
      match: { pipelineId: null, stageName: null, anyPatterns: [], anyHintSubstrings: [] },
      action: { type: "retry_stage" as const, maxAttempts: 3, backoffSeconds: 0 },
    };

    await runStage(noLogger, "run-3", baseStage, [retryRule], "pipe-1", null, {});

    // Should have been called twice: once failing, once succeeding
    expect(callCount).toBe(2);
    expect(setStageStatus).toHaveBeenCalledWith("run-3", "build", "success", 0);
    // Attempt counter recorded on second attempt
    expect(recordRuleOutcome).toHaveBeenCalledWith("rule-1", "attempt", noLogger);
    // Save recorded because retry ultimately succeeded
    expect(recordRuleOutcome).toHaveBeenCalledWith("rule-1", "save", noLogger);
  });
});

describe("runStage — max retries exceeded", () => {
  it("throws after exhausting all retry attempts", async () => {
    const setStageStatus = vi.fn().mockResolvedValue(undefined);

    vi.doMock("./api-client.js", () => ({
      upsertStage: vi.fn().mockResolvedValue(undefined),
      setStageStatus,
      appendLogs: vi.fn().mockResolvedValue(undefined),
      postStageMetrics: vi.fn().mockResolvedValue(undefined),
      fetchDiagnosis: vi.fn().mockResolvedValue(null),
      recordRuleOutcome: vi.fn().mockResolvedValue(undefined),
      uploadArtifacts: vi.fn(),
      uploadCache: vi.fn(),
      downloadCache: vi.fn(),
    }));
    vi.doMock("./container-runner.js", () => ({
      runContainer: vi.fn().mockResolvedValue({
        statusCode: 1,
        cpuSeconds: null,
        cpuPercentAvg: null,
        cpuPercentMax: null,
        memBytesMax: null,
        memBytesAvg: null,
      }),
      StageTimeoutError: class StageTimeoutError extends Error {},
    }));
    vi.doMock("./config.js", () => ({ getDefaultTimeoutMs: () => null, getRunnerId: () => "runner-123" }));

    const { runStage } = await import("./stage-runner.js");

    const retryRule = {
      id: "rule-2",
      enabled: true,
      name: "retry",
      match: { pipelineId: null, stageName: null, anyPatterns: [], anyHintSubstrings: [] },
      action: { type: "retry_stage" as const, maxAttempts: 2, backoffSeconds: 0 },
    };

    await expect(
      runStage(noLogger, "run-4", baseStage, [retryRule], "pipe-1", null, {}),
    ).rejects.toThrow("failed with exit code 1");
  });
});

describe("runStage — timeout", () => {
  it("rethrows StageTimeoutError from container-runner", async () => {
    class StageTimeoutError extends Error {
      constructor() {
        super("Stage timed out");
        this.name = "StageTimeoutError";
      }
    }

    vi.doMock("./api-client.js", () => ({
      upsertStage: vi.fn().mockResolvedValue(undefined),
      setStageStatus: vi.fn().mockResolvedValue(undefined),
      appendLogs: vi.fn().mockResolvedValue(undefined),
      postStageMetrics: vi.fn().mockResolvedValue(undefined),
      fetchDiagnosis: vi.fn().mockResolvedValue(null),
      recordRuleOutcome: vi.fn(),
      uploadArtifacts: vi.fn(),
      uploadCache: vi.fn(),
      downloadCache: vi.fn(),
    }));
    vi.doMock("./container-runner.js", () => ({
      runContainer: vi.fn().mockRejectedValue(new StageTimeoutError()),
      StageTimeoutError,
    }));
    vi.doMock("./config.js", () => ({ getDefaultTimeoutMs: () => 100, getRunnerId: () => "runner-123" }));

    const { runStage } = await import("./stage-runner.js");

    await expect(
      runStage(noLogger, "run-5", { ...baseStage, timeout_minutes: 1 }, [], "pipe-1", null, {}),
    ).rejects.toThrow("timed out");
  });
});

describe("runStage — secret scrubbing", () => {
  it("does not log raw secret values in chunks", async () => {
    const appendLogs = vi.fn().mockResolvedValue(undefined);
    const SECRET = "super-secret-password";
    let capturedChunk = "";

    vi.doMock("./api-client.js", () => ({
      upsertStage: vi.fn().mockResolvedValue(undefined),
      setStageStatus: vi.fn().mockResolvedValue(undefined),
      appendLogs,
      postStageMetrics: vi.fn().mockResolvedValue(undefined),
      fetchDiagnosis: vi.fn().mockResolvedValue(null),
      recordRuleOutcome: vi.fn(),
      uploadArtifacts: vi.fn(),
      uploadCache: vi.fn(),
      downloadCache: vi.fn(),
    }));
    vi.doMock("./container-runner.js", () => ({
      runContainer: vi.fn().mockImplementation(async (input: { onStdout: (b: Buffer) => void }) => {
        input.onStdout(Buffer.from(`echo ${SECRET} done`));
        return { statusCode: 0, cpuSeconds: null, cpuPercentAvg: null, cpuPercentMax: null, memBytesMax: null, memBytesAvg: null };
      }),
      StageTimeoutError: class StageTimeoutError extends Error {},
    }));
    vi.doMock("./config.js", () => ({ getDefaultTimeoutMs: () => null, getRunnerId: () => "runner-123" }));

    const { runStage } = await import("./stage-runner.js");
    await runStage(noLogger, "run-6", baseStage, [], "pipe-1", null, { MY_SECRET: SECRET });

    // Find the log append call that would contain the secret
    for (const call of appendLogs.mock.calls as [string, string, string][]) {
      if (call[2]?.includes("done")) {
        capturedChunk = call[2];
      }
    }

    expect(capturedChunk).not.toContain(SECRET);
    expect(capturedChunk).toContain("***");
  });
});
