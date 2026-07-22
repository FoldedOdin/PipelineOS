import { container } from "../bootstrap/index.js";
import type { UpdateRunInput } from "../domain/index.js";
import { flakinessService } from "../services/flakinessService.js";
import { publishRunStatus, publishStageLog, publishStageStatus } from "../ws/logStream.js";
import { pino } from "pino";

const runnerServiceLogger = pino({ name: "runnerService" });

type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";
type StageStatus = "pending" | "running" | "success" | "failed" | "skipped";
type RunnerId = string;

function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

const claimLeaseMs = minutesToMs(1);

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function readStringField(body: unknown, key: string): string | null {
  if (typeof body !== "object" || body === null) return null;
  return requiredString((body as Record<string, unknown>)[key]);
}

function readNumberField(body: unknown, key: string): number | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[key];
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNullableNumberField(body: unknown, key: string): number | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[key];
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isStageStatus(value: unknown): value is StageStatus {
  return value === "pending" || value === "running" || value === "success" || value === "failed" || value === "skipped";
}

function isRunStatus(value: unknown): value is RunStatus {
  return value === "queued" || value === "running" || value === "success" || value === "failed" || value === "cancelled";
}

export const runnerService = {
  async claimNextQueuedRun(runnerId: RunnerId): Promise<Record<string, unknown> | null> {
    const nowStr = new Date().toISOString();
    const dto = await container.persistence.runRepository.claimNextQueuedRun(runnerId, nowStr);
    if (!dto) return null;

    await container.persistence.runnerRegistrationRepository.registerOrHeartbeat({
      runnerId,
      lastHeartbeatAt: new Date(),
      status: "online",
    });

    return { ...dto, _id: dto.id };
  },

  async heartbeatRun(runId: string, runnerId: RunnerId): Promise<boolean> {
    const run = await container.persistence.runRepository.findById(runId);
    if (!run || run.status !== "running" || run.claimedBy !== runnerId) return false;

    const now = new Date();
    const leaseUntil = new Date(now.getTime() + claimLeaseMs);
    const updated = await container.persistence.runRepository.update(runId, {
      lastHeartbeatAt: now,
      claimExpiresAt: leaseUntil,
    });

    if (updated !== null) {
      await container.persistence.runnerRegistrationRepository.registerOrHeartbeat({
        runnerId,
        lastHeartbeatAt: now,
        status: "online",
      });
      runnerServiceLogger.debug({ event: "run_heartbeat", runId, runnerId }, "Run heartbeat received");
    }

    return updated !== null;
  },

  async registerRunner(runnerId: string, info?: { version?: string; hostname?: string; platform?: string; activeRuns?: number; maxConcurrentRuns?: number }): Promise<void> {
    const patch = info ?? {};
    await container.persistence.runnerRegistrationRepository.registerOrHeartbeat({
      runnerId,
      lastHeartbeatAt: new Date(),
      status: "online",
      ...patch,
    });
  },

  async listRunners(): Promise<(Record<string, unknown> & { isStale: boolean })[]> {
    const RUNNER_STALE_MS = 30_000; // 30 seconds
    const runners = await container.persistence.runnerRegistrationRepository.findAll();
    const now = Date.now();
    const sorted = [...runners].sort((a, b) => {
      const tA = a.lastHeartbeatAt?.getTime() ?? 0;
      const tB = b.lastHeartbeatAt?.getTime() ?? 0;
      return tB - tA;
    });
    return sorted.map((r) => {
      const hb = r.lastHeartbeatAt?.getTime() ?? 0;
      return { ...r, isStale: now - hb > RUNNER_STALE_MS };
    });
  },

  async updateRunStatus(runId: string, body: unknown): Promise<Record<string, unknown> | null> {
    const statusValue = typeof body === "object" && body !== null ? (body as Record<string, unknown>).status : undefined;
    const status = isRunStatus(statusValue) ? statusValue : null;
    if (status === null) return null;

    const patch: UpdateRunInput = { status };
    if (status === "success" || status === "failed" || status === "cancelled") {
      patch.finishedAt = new Date();
      patch.claimedBy = null;
      patch.claimExpiresAt = null;
    }

    const updated = await container.persistence.runRepository.update(runId, patch);
    if (updated !== null) {
      publishRunStatus(runId, status);
      return { ...updated, _id: updated.id };
    }
    return null;
  },

  async upsertStage(runId: string, stageName: string, body: unknown): Promise<boolean> {
    const image = readStringField(body, "image");
    const command = readStringField(body, "command");
    if (image === null || command === null) return false;

    const run = await container.persistence.runRepository.findById(runId);
    if (run === null) return false;

    const stages = [...run.stages];
    const index = stages.findIndex((s) => s.name === stageName);
    if (index >= 0) {
      stages[index] = {
        ...stages[index],
        image,
        command,
      };
    } else {
      stages.push({
        name: stageName,
        status: "pending",
        image,
        command,
        exitCode: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        logs: "",
        metrics: {
          cpuSeconds: null,
          cpuPercentAvg: null,
          cpuPercentMax: null,
          memBytesMax: null,
          costUsdEstimated: null,
        },
      });
    }

    const updated = await container.persistence.runRepository.update(runId, { stages });
    if (updated !== null) {
      // Notify WebSocket subscribers that a new stage has been registered.
      const newIdx = index >= 0 ? index : stages.length - 1;
      publishStageStatus(runId, stageName, stages[newIdx]?.status ?? "pending");
    }
    return updated !== null;
  },

  async updateStageStatus(runId: string, stageName: string, body: unknown): Promise<boolean> {
    const statusValue = typeof body === "object" && body !== null ? (body as Record<string, unknown>).status : undefined;
    const status = isStageStatus(statusValue) ? statusValue : null;
    const exitCode = readNumberField(body, "exitCode");
    if (status === null) return false;

    const run = await container.persistence.runRepository.findById(runId);
    if (run === null) return false;

    const stages = [...run.stages];
    const index = stages.findIndex((s) => s.name === stageName);
    if (index < 0) return false;

    const stage = { ...stages[index], status };
    if (status === "running") {
      stage.startedAt = new Date();
      stage.finishedAt = null;
      stage.durationMs = null;
      stage.exitCode = null;
    } else if (status === "success" || status === "failed" || status === "skipped") {
      stage.finishedAt = new Date();
      if (stage.startedAt instanceof Date) {
        stage.durationMs = stage.finishedAt.getTime() - stage.startedAt.getTime();
      }
      if (exitCode !== null) {
        stage.exitCode = exitCode;
      }
    }
    stages[index] = stage;

    const updated = await container.persistence.runRepository.update(runId, { stages });
    if (!updated) return false;

    publishStageStatus(runId, stageName, status);

    if (status === "success" || status === "failed") {
      const pipelineId = run.pipelineId;
      void flakinessService
        .recordOutcome({
          pipelineId,
          stageName,
          runId: run.id,
          success: status === "success",
        })
        .catch(() => undefined);
    }

    return true;
  },

  async appendStageLogs(runId: string, stageName: string, body: unknown): Promise<boolean> {
    const logs = readStringField(body, "logs");
    if (logs === null) return false;

    const run = await container.persistence.runRepository.findById(runId);
    if (run === null) return false;

    const stages = [...run.stages];
    const index = stages.findIndex((s) => s.name === stageName);
    if (index < 0) return false;

    const chunk = logs;

    try {
      await container.logStorage.appendLog(run.pipelineId, runId, stageName, chunk);
    } catch (e) {
      runnerServiceLogger.error({ err: e, runId, stageName }, "Failed to append logs to storage");
      return false;
    }

    publishStageLog(runId, stageName, chunk);
    return true;
  },

  async updateStageMetrics(runId: string, stageName: string, body: unknown): Promise<boolean> {
    const cpuSeconds = readNullableNumberField(body, "cpuSeconds");
    const cpuPercentAvg = readNullableNumberField(body, "cpuPercentAvg");
    const cpuPercentMax = readNullableNumberField(body, "cpuPercentMax");
    const memBytesMax = readNullableNumberField(body, "memBytesMax");
    const costUsdEstimated = readNullableNumberField(body, "costUsdEstimated");

    const run = await container.persistence.runRepository.findById(runId);
    if (run === null) return false;

    const stages = [...run.stages];
    const index = stages.findIndex((s) => s.name === stageName);
    if (index < 0) return false;

    const existingMetrics = stages[index].metrics ?? {};
    const metrics = { ...existingMetrics };
    if (cpuSeconds !== null) metrics.cpuSeconds = cpuSeconds;
    if (cpuPercentAvg !== null) metrics.cpuPercentAvg = cpuPercentAvg;
    if (cpuPercentMax !== null) metrics.cpuPercentMax = cpuPercentMax;
    if (memBytesMax !== null) metrics.memBytesMax = memBytesMax;
    if (costUsdEstimated !== null) metrics.costUsdEstimated = costUsdEstimated;

    stages[index] = {
      ...stages[index],
      metrics,
    };

    const updated = await container.persistence.runRepository.update(runId, { stages });
    return updated !== null;
  },
} as const;
