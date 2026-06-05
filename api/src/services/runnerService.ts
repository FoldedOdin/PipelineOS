import { isValidObjectId } from "mongoose";
import { Run } from "../models/Run.js";
import { RunnerRegistration } from "../models/RunnerRegistration.js";
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

interface StageDoc {
  name: string;
  status: StageStatus;
  image: string;
  command: string;
  exitCode: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  logs: string;
  metrics?: {
    cpuSeconds?: number | null;
    cpuPercentAvg?: number | null;
    cpuPercentMax?: number | null;
    memBytesMax?: number | null;
    costUsdEstimated?: number | null;
  };
}

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
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + claimLeaseMs);
    const doc = await Run.findOneAndUpdate(
      {
        status: "queued",
        $or: [{ claimExpiresAt: null }, { claimExpiresAt: { $lte: now } }],
      },
      {
        $set: {
          status: "running",
          startedAt: now,
          lastHeartbeatAt: now,
          claimedBy: runnerId,
          claimExpiresAt: leaseUntil,
        },
      },
      { sort: { createdAt: 1 }, new: true },
    )
      .lean<Record<string, unknown>>()
      .exec();

    await RunnerRegistration.findOneAndUpdate(
      { runnerId },
      { $set: { runnerId, lastHeartbeatAt: now, status: "online" } },
      { upsert: true }
    ).exec();

    return doc;
  },

  async heartbeatRun(runId: string, runnerId: RunnerId): Promise<boolean> {
    if (!isValidObjectId(runId)) return false;
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + claimLeaseMs);
    const updated = await Run.findOneAndUpdate(
      { _id: runId, status: "running", claimedBy: runnerId },
      { $set: { lastHeartbeatAt: now, claimExpiresAt: leaseUntil } },
    ).exec();

    if (updated !== null) {
      await RunnerRegistration.findOneAndUpdate(
        { runnerId },
        { $set: { runnerId, lastHeartbeatAt: now, status: "online" } },
        { upsert: true }
      ).exec();
    }

    runnerServiceLogger.debug({ event: "run_heartbeat", runId, runnerId }, "Run heartbeat received");
    return updated !== null;
  },

  async registerRunner(runnerId: string, info?: { version?: string; hostname?: string; platform?: string }): Promise<void> {
    const patch = info || {};
    await RunnerRegistration.findOneAndUpdate(
      { runnerId },
      { $set: { runnerId, lastHeartbeatAt: new Date(), status: "online", ...patch } },
      { upsert: true }
    ).exec();
  },

  async listRunners(): Promise<(Record<string, unknown> & { isStale: boolean })[]> {
    const RUNNER_STALE_MS = 30_000; // 30 seconds
    const runners = await RunnerRegistration.find().sort({ lastHeartbeatAt: -1 }).lean<Record<string, unknown>[]>().exec();
    const now = Date.now();
    return runners.map(r => {
      const hb = r.lastHeartbeatAt instanceof Date ? r.lastHeartbeatAt.getTime() : 0;
      return { ...r, isStale: now - hb > RUNNER_STALE_MS };
    });
  },

  async updateRunStatus(runId: string, body: unknown): Promise<Record<string, unknown> | null> {
    if (!isValidObjectId(runId)) return null;
    const statusValue = typeof body === "object" && body !== null ? (body as Record<string, unknown>).status : undefined;
    const status = isRunStatus(statusValue) ? statusValue : null;
    if (status === null) return null;

    const patch: Record<string, unknown> = { status };
    if (status === "success" || status === "failed" || status === "cancelled") {
      patch.finishedAt = new Date();
      patch.claimedBy = null;
      patch.claimExpiresAt = null;
    }

    const updated = await Run.findByIdAndUpdate(runId, { $set: patch }, { new: true }).lean<Record<string, unknown>>().exec();
    if (updated !== null) {
      publishRunStatus(runId, status);
    }
    return updated;
  },

  async upsertStage(runId: string, stageName: string, body: unknown): Promise<boolean> {
    if (!isValidObjectId(runId)) return false;
    const image = readStringField(body, "image");
    const command = readStringField(body, "command");
    if (image === null || command === null) return false;

    const run = await Run.findById(runId).exec();
    if (run === null) return false;

    const stages = run.stages as unknown as StageDoc[];
    const existing = stages.find((s) => s.name === stageName);
    if (existing) {
      existing.image = image;
      existing.command = command;
      await run.save();
      return true;
    }

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
    });
    await run.save();
    return true;
  },

  async updateStageStatus(runId: string, stageName: string, body: unknown): Promise<boolean> {
    if (!isValidObjectId(runId)) return false;
    const statusValue = typeof body === "object" && body !== null ? (body as Record<string, unknown>).status : undefined;
    const status = isStageStatus(statusValue) ? statusValue : null;
    const exitCode = readNumberField(body, "exitCode");
    if (status === null) return false;

    const run = await Run.findById(runId).exec();
    if (run === null) return false;

    const stages = run.stages as unknown as StageDoc[];
    const stage = stages.find((s) => s.name === stageName);
    if (stage === undefined) return false;

    stage.status = status;
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

    await run.save();
    publishStageStatus(runId, stageName, status);

    if (status === "success" || status === "failed") {
      const pipelineId = typeof run.pipelineId === "string" ? run.pipelineId : String(run.pipelineId);
      void flakinessService
        .recordOutcome({
          pipelineId,
          stageName,
          runId: run._id,
          success: status === "success",
        })
        .catch(() => undefined);
    }

    return true;
  },

  async appendStageLogs(runId: string, stageName: string, body: unknown): Promise<boolean> {
    if (!isValidObjectId(runId)) return false;
    const logs = readStringField(body, "logs");
    if (logs === null) return false;

    const run = await Run.findById(runId).exec();
    if (run === null) return false;

    const stages = run.stages as unknown as StageDoc[];
    const stage = stages.find((s) => s.name === stageName);
    if (stage === undefined) return false;

    const maxChunkChars = 16_384;
    const maxStoredChars = 1_000_000;
    const chunk = logs.length > maxChunkChars ? logs.slice(-maxChunkChars) : logs;

    stage.logs = `${stage.logs}${chunk}`;
    if (stage.logs.length > maxStoredChars) {
      stage.logs = stage.logs.slice(-maxStoredChars);
    }
    await run.save();
    publishStageLog(runId, stageName, chunk);
    return true;
  },

  async updateStageMetrics(runId: string, stageName: string, body: unknown): Promise<boolean> {
    if (!isValidObjectId(runId)) return false;

    const cpuSeconds = readNullableNumberField(body, "cpuSeconds");
    const cpuPercentAvg = readNullableNumberField(body, "cpuPercentAvg");
    const cpuPercentMax = readNullableNumberField(body, "cpuPercentMax");
    const memBytesMax = readNullableNumberField(body, "memBytesMax");
    const costUsdEstimated = readNullableNumberField(body, "costUsdEstimated");

    const run = await Run.findById(runId).exec();
    if (run === null) return false;

    const stages = run.stages as unknown as StageDoc[];
    const stage = stages.find((s) => s.name === stageName);
    if (stage === undefined) return false;

    stage.metrics ??= {};
    if (cpuSeconds !== null) stage.metrics.cpuSeconds = cpuSeconds;
    if (cpuPercentAvg !== null) stage.metrics.cpuPercentAvg = cpuPercentAvg;
    if (cpuPercentMax !== null) stage.metrics.cpuPercentMax = cpuPercentMax;
    if (memBytesMax !== null) stage.metrics.memBytesMax = memBytesMax;
    if (costUsdEstimated !== null) stage.metrics.costUsdEstimated = costUsdEstimated;

    await run.save();
    return true;
  },
} as const;

