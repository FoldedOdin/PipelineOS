import { isValidObjectId } from "mongoose";
import { Run } from "../models/Run.js";
import { publishRunStatus, publishStageLog, publishStageStatus } from "../ws/logStream.js";

type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";
type StageStatus = "pending" | "running" | "success" | "failed" | "skipped";

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

function isStageStatus(value: unknown): value is StageStatus {
  return value === "pending" || value === "running" || value === "success" || value === "failed" || value === "skipped";
}

function isRunStatus(value: unknown): value is RunStatus {
  return value === "queued" || value === "running" || value === "success" || value === "failed" || value === "cancelled";
}

export const runnerService = {
  async claimNextQueuedRun(): Promise<Record<string, unknown> | null> {
    const doc = await Run.findOneAndUpdate(
      { status: "queued" },
      { $set: { status: "running", startedAt: new Date(), lastHeartbeatAt: new Date() } },
      { sort: { createdAt: 1 }, new: true },
    )
      .lean<Record<string, unknown>>()
      .exec();

    return doc;
  },

  async heartbeatRun(runId: string): Promise<boolean> {
    if (!isValidObjectId(runId)) return false;
    const updated = await Run.findByIdAndUpdate(runId, { $set: { lastHeartbeatAt: new Date() } }).exec();
    return updated !== null;
  },

  async updateRunStatus(runId: string, body: unknown): Promise<Record<string, unknown> | null> {
    if (!isValidObjectId(runId)) return null;
    const statusValue = typeof body === "object" && body !== null ? (body as Record<string, unknown>).status : undefined;
    const status = isRunStatus(statusValue) ? statusValue : null;
    if (status === null) return null;

    const patch: Record<string, unknown> = { status };
    if (status === "success" || status === "failed" || status === "cancelled") {
      patch.finishedAt = new Date();
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
} as const;

