/**
 * Persistence and querying for pipeline runs.
 * Expanded when REST run endpoints are implemented.
 */
import { isValidObjectId } from "mongoose";
import { Run } from "../models/Run.js";
import type { RunEvent } from "../models/Run.js";

export type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";

export interface RunsListResult {
  page: number;
  limit: number;
  total: number;
  items: Record<string, unknown>[];
}

export interface ReplayRunOptions {
  triggeredBy?: string;
}

interface ReplaySourceRun {
  pipelineId: string;
  commitSha: string;
  branch: string;
  event: RunEvent;
}

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

export const runService = {
  async listRuns(input: { page: number; limit: number }): Promise<RunsListResult> {
    const page = clampPositiveInt(input.page, 1);
    const limit = Math.min(100, clampPositiveInt(input.limit, 20));
    const skip = (page - 1) * limit;

    const [total, docs] = await Promise.all([
      Run.countDocuments({}).exec(),
      Run.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<Record<string, unknown>[]>()
        .exec(),
    ]);

    return { page, limit, total, items: docs };
  },

  async listPipelineIds(): Promise<string[]> {
    return await Run.distinct("pipelineId").exec();
  },

  async getRunById(id: string): Promise<Record<string, unknown> | null> {
    if (!isValidObjectId(id)) return null;
    return await Run.findById(id).lean<Record<string, unknown>>().exec();
  },

  async replayRun(id: string, options: ReplayRunOptions = {}): Promise<Record<string, unknown> | null> {
    if (!isValidObjectId(id)) return null;
    const source = await Run.findById(id)
      .select({ pipelineId: 1, commitSha: 1, branch: 1, event: 1 })
      .lean<ReplaySourceRun>()
      .exec();
    if (source === null) return null;

    const triggeredBy = typeof options.triggeredBy === "string" && options.triggeredBy.trim() !== "" ? options.triggeredBy.trim() : "replay";
    const replay = new Run({
      pipelineId: source.pipelineId,
      commitSha: source.commitSha,
      branch: source.branch,
      triggeredBy,
      event: source.event,
      status: "queued",
      stages: [],
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      lastHeartbeatAt: null,
      claimedBy: null,
      claimExpiresAt: null,
    });
    await replay.save();

    return replay.toObject() as unknown as Record<string, unknown>;
  },

  async getStageLogs(runId: string, stageName: string): Promise<string | null> {
    if (!isValidObjectId(runId)) return null;
    const run = await Run.findById(runId).select({ stages: 1 }).lean<{ stages?: unknown[] }>().exec();
    if (run === null) return null;
    const stages = Array.isArray(run.stages) ? run.stages : [];
    const stage = stages.find((s) => typeof s === "object" && s !== null && (s as Record<string, unknown>).name === stageName);
    if (stage === undefined) return null;
    const logs = (stage as Record<string, unknown>).logs;
    return typeof logs === "string" ? logs : "";
  },
} as const;
