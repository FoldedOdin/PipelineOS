import { isValidObjectId } from "mongoose";
import type {
  IStageRepository,
  StageDTO,
  UpdateStageStatusInput,
} from "../../../../../domain/index.js";
import { Run, type RunStageResult as MongoStageResult } from "../../../../../models/Run.js";
import { StageMapper } from "../mappers/index.js";

export class MongoStageRepository implements IStageRepository {
  async findByRunId(runId: string): Promise<StageDTO[]> {
    if (!isValidObjectId(runId)) return [];
    const run = await Run.findById(runId).exec();
    if (!run) return [];
    return (run.stages ?? []).map((s: unknown) => StageMapper.toDTO(s as MongoStageResult));
  }

  async findStage(runId: string, stageName: string): Promise<StageDTO | null> {
    if (!isValidObjectId(runId)) return null;
    const run = await Run.findById(runId).exec();
    if (!run) return null;
    const stage = (run.stages ?? []).find((s: unknown) => (s as MongoStageResult).name === stageName);
    return stage ? StageMapper.toDTO(stage as unknown as MongoStageResult) : null;
  }

  async updateStatus(
    runId: string,
    stageName: string,
    input: UpdateStageStatusInput
  ): Promise<StageDTO | null> {
    if (!isValidObjectId(runId)) return null;
    const run = await Run.findById(runId).exec();
    if (!run) return null;

    const stages = run.stages ?? [];
    const stage = stages.find((s: unknown) => (s as MongoStageResult).name === stageName) as unknown as (MongoStageResult & { status: string });
    if (!stage) return null;

    stage.status = input.status;
    if (input.exitCode !== undefined) stage.exitCode = input.exitCode;
    if (input.startedAt !== undefined) stage.startedAt = input.startedAt;
    if (input.finishedAt !== undefined) stage.finishedAt = input.finishedAt;
    if (input.durationMs !== undefined) stage.durationMs = input.durationMs;
    if (input.metrics) {
      stage.metrics ??= {
        cpuSeconds: null,
        cpuPercentAvg: null,
        cpuPercentMax: null,
        memBytesMax: null,
        costUsdEstimated: null,
      };
      if (input.metrics.cpuSeconds !== undefined) stage.metrics.cpuSeconds = input.metrics.cpuSeconds ?? null;
      if (input.metrics.cpuPercentAvg !== undefined) stage.metrics.cpuPercentAvg = input.metrics.cpuPercentAvg ?? null;
      if (input.metrics.cpuPercentMax !== undefined) stage.metrics.cpuPercentMax = input.metrics.cpuPercentMax ?? null;
      if (input.metrics.memBytesMax !== undefined) stage.metrics.memBytesMax = input.metrics.memBytesMax ?? null;
      if (input.metrics.costUsdEstimated !== undefined) stage.metrics.costUsdEstimated = input.metrics.costUsdEstimated ?? null;
    }

    await run.save();
    return StageMapper.toDTO(stage);
  }
}
