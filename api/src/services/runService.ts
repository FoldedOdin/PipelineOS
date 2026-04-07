/**
 * Persistence and querying for pipeline runs.
 * Expanded when REST run endpoints are implemented.
 */
import { isValidObjectId } from "mongoose";
import { Run } from "../models/Run.js";

export type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";

export interface RunsListResult {
  page: number;
  limit: number;
  total: number;
  items: unknown[];
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
        .lean()
        .exec(),
    ]);

    return { page, limit, total, items: docs };
  },

  async getRunById(id: string): Promise<unknown | null> {
    if (!isValidObjectId(id)) return null;
    return await Run.findById(id).lean().exec();
  },

  async getStageLogs(runId: string, stageName: string): Promise<string | null> {
    if (!isValidObjectId(runId)) return null;
    const run = await Run.findById(runId).select({ stages: 1 }).lean().exec();
    if (run === null) return null;
    const stage = (run.stages ?? []).find((s: any) => s?.name === stageName);
    if (!stage) return null;
    return typeof stage.logs === "string" ? stage.logs : "";
  },
} as const;
