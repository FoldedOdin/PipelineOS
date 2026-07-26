/**
 * Persistence and querying for pipeline runs.
 * Expanded when REST run endpoints are implemented.
 */
import { container } from "../bootstrap/index.js";
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
      container.persistence.runRepository.countAll(),
      container.persistence.runRepository.findPaginated({ skip, limit }),
    ]);

    return { page, limit, total, items: docs as unknown as Record<string, unknown>[] };
  },

  async listPipelineIds(): Promise<string[]> {
    return await container.persistence.runRepository.findDistinctPipelines();
  },

  async getRunById(id: string): Promise<Record<string, unknown> | null> {
    const run = await container.persistence.runRepository.findById(id);
    return run === null ? null : (run as unknown as Record<string, unknown>);
  },

  async replayRun(
    id: string,
    options: ReplayRunOptions = {},
  ): Promise<Record<string, unknown> | null> {
    const source = await container.persistence.runRepository.findById(id);
    if (source === null) return null;

    const triggeredBy =
      typeof options.triggeredBy === "string" && options.triggeredBy.trim() !== ""
        ? options.triggeredBy.trim()
        : "replay";
    const replay = await container.persistence.runRepository.create({
      pipelineId: source.pipelineId,
      commitSha: source.commitSha,
      branch: source.branch,
      triggeredBy,
      event: source.event,
      status: "queued",
      stages: [],
    });

    return replay as unknown as Record<string, unknown>;
  },

  async getStageLogs(runId: string, stageName: string): Promise<string | null> {
    const run = await container.persistence.runRepository.findById(runId);
    if (run === null) return null;
    const stages = Array.isArray(run.stages) ? run.stages : [];
    const stage = stages.find((s) => typeof s === "object" && s !== null && s.name === stageName);
    if (stage === undefined) return null;
    return typeof stage.logs === "string" ? stage.logs : "";
  },
} as const;
