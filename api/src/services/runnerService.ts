import { isValidObjectId } from "mongoose";
import { Run } from "../models/Run.js";

type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function isRunStatus(value: unknown): value is RunStatus {
  return value === "queued" || value === "running" || value === "success" || value === "failed" || value === "cancelled";
}

export const runnerService = {
  async claimNextQueuedRun(): Promise<unknown | null> {
    const doc = await Run.findOneAndUpdate(
      { status: "queued" },
      { $set: { status: "running", startedAt: new Date() } },
      { sort: { createdAt: 1 }, new: true },
    )
      .lean()
      .exec();

    return doc;
  },

  async updateRunStatus(runId: string, body: unknown): Promise<unknown | null> {
    if (!isValidObjectId(runId)) return null;
    const status = isRunStatus((body as any)?.status) ? ((body as any).status as RunStatus) : null;
    if (status === null) return null;

    const patch: Record<string, unknown> = { status };
    if (status === "success" || status === "failed" || status === "cancelled") {
      patch.finishedAt = new Date();
    }

    const updated = await Run.findByIdAndUpdate(runId, { $set: patch }, { new: true }).lean().exec();
    return updated;
  },

  async appendStageLogs(runId: string, stageName: string, body: unknown): Promise<boolean> {
    if (!isValidObjectId(runId)) return false;
    const logs = requiredString((body as any)?.logs);
    if (logs === null) return false;

    const run = await Run.findById(runId).exec();
    if (run === null) return false;

    const stage = run.stages.find((s: any) => s?.name === stageName);
    if (!stage) return false;

    stage.logs = `${stage.logs ?? ""}${logs}`;
    await run.save();
    return true;
  },
} as const;

