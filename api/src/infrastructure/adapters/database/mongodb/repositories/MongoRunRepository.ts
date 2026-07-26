import { isValidObjectId } from "mongoose";
import type {
  IRunRepository,
  RunDTO,
  CreateRunInput,
  UpdateRunInput,
  RemediationAttemptDTO,
  StageDTO,
  StageCostAggregateDTO,
} from "../../../../../domain/index.js";
import { Run, type RunDocument } from "../../../../../models/Run.js";
import { RunMapper, StageMapper } from "../mappers/index.js";

export class MongoRunRepository implements IRunRepository {
  async findById(runId: string): Promise<RunDTO | null> {
    if (!isValidObjectId(runId)) return null;
    const doc = await Run.findById(runId).exec();
    return doc ? RunMapper.toDTO(doc as unknown as RunDocument) : null;
  }

  async findByPipeline(pipelineId: string, limit = 50): Promise<RunDTO[]> {
    const docs = await Run.find({ pipelineId }).sort({ createdAt: -1 }).limit(limit).exec();
    return docs.map((d: unknown) => RunMapper.toDTO(d as RunDocument));
  }

  async findRecent(options?: { limit?: number; since?: string }): Promise<RunDTO[]> {
    const limit = options?.limit ?? 50;
    const filter: Record<string, unknown> = {};
    if (options?.since) {
      filter.createdAt = { $gte: new Date(options.since) };
    }
    const docs = await Run.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
    return docs.map((d: unknown) => RunMapper.toDTO(d as RunDocument));
  }

  async countAll(): Promise<number> {
    return await Run.countDocuments({}).exec();
  }

  async findPaginated(options: { skip?: number; limit?: number }): Promise<RunDTO[]> {
    const skip = options.skip ?? 0;
    const limit = options.limit ?? 20;
    const docs = await Run.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
    return docs.map((d: unknown) => RunMapper.toDTO(d as RunDocument));
  }

  async findDistinctPipelines(): Promise<string[]> {
    return await Run.distinct("pipelineId").exec();
  }

  async findStaleRuns(staleBefore: Date, limit = 25): Promise<RunDTO[]> {
    const docs = await Run.find({
      status: "running",
      startedAt: { $ne: null, $lte: staleBefore },
      $or: [
        { claimExpiresAt: { $ne: null, $lte: new Date() } },
        { lastHeartbeatAt: null },
        { lastHeartbeatAt: { $lte: staleBefore } },
      ],
    })
      .limit(limit)
      .exec();
    return docs.map((d: unknown) => RunMapper.toDTO(d as RunDocument));
  }

  async topStageCosts(
    pipelineId: string,
    limit: number,
    since: Date,
  ): Promise<StageCostAggregateDTO[]> {
    const rows = await Run.aggregate<{
      _id: string;
      runs: number;
      total: number;
      avg: number;
      max: number;
    }>([
      { $match: { pipelineId, createdAt: { $gte: since } } },
      { $unwind: "$stages" },
      { $match: { "stages.metrics.costUsdEstimated": { $ne: null } } },
      {
        $group: {
          _id: "$stages.name",
          runs: { $sum: 1 },
          total: { $sum: "$stages.metrics.costUsdEstimated" },
          avg: { $avg: "$stages.metrics.costUsdEstimated" },
          max: { $max: "$stages.metrics.costUsdEstimated" },
        },
      },
      { $sort: { total: -1 } },
      { $limit: limit },
    ]).exec();

    return rows.map((r) => ({
      stageName: r._id,
      runs: r.runs,
      totalCostUsd: r.total,
      avgCostUsd: r.avg,
      maxCostUsd: r.max,
    }));
  }

  async findAssignedRuns(): Promise<RunDTO[]> {
    const docs = await Run.find({
      status: "running",
      claimedBy: { $ne: null },
    }).exec();
    return docs.map((d: unknown) => RunMapper.toDTO(d as RunDocument));
  }

  async create(input: CreateRunInput): Promise<RunDTO> {
    const stages = (input.stages ?? []).map((s: StageDTO) => StageMapper.toMongo(s));
    const doc = await Run.create({
      pipelineId: input.pipelineId,
      commitSha: input.commitSha,
      branch: input.branch,
      triggeredBy: input.triggeredBy,
      event: input.event,
      status: input.status ?? "queued",
      stages,
    });
    return RunMapper.toDTO(doc as unknown as RunDocument);
  }

  async update(runId: string, updates: UpdateRunInput): Promise<RunDTO | null> {
    if (!isValidObjectId(runId)) return null;
    const setFields: Record<string, unknown> = {};
    if (updates.status !== undefined) setFields.status = updates.status;
    if (updates.startedAt !== undefined) setFields.startedAt = updates.startedAt;
    if (updates.finishedAt !== undefined) setFields.finishedAt = updates.finishedAt;
    if (updates.durationMs !== undefined) setFields.durationMs = updates.durationMs;
    if (updates.lastHeartbeatAt !== undefined) setFields.lastHeartbeatAt = updates.lastHeartbeatAt;
    if (updates.claimedBy !== undefined) setFields.claimedBy = updates.claimedBy;
    if (updates.claimExpiresAt !== undefined) setFields.claimExpiresAt = updates.claimExpiresAt;
    if (updates.stages !== undefined) {
      setFields.stages = updates.stages.map((s: StageDTO) => StageMapper.toMongo(s));
    }
    if (updates.remediationHistory !== undefined) {
      setFields.remediationHistory = updates.remediationHistory;
    }

    const doc = await Run.findByIdAndUpdate(runId, { $set: setFields }, { new: true }).exec();
    return doc ? RunMapper.toDTO(doc as unknown as RunDocument) : null;
  }

  async claimNextQueuedRun(runnerId: string, assignedAt: string): Promise<RunDTO | null> {
    const now = new Date(assignedAt);
    const leaseUntil = new Date(now.getTime() + 60 * 1000);
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
    ).exec();
    return doc ? RunMapper.toDTO(doc as unknown as RunDocument) : null;
  }

  async addRemediationHistory(
    runId: string,
    attempt: RemediationAttemptDTO,
  ): Promise<RunDTO | null> {
    if (!isValidObjectId(runId)) return null;
    const doc = await Run.findByIdAndUpdate(
      runId,
      {
        $push: {
          remediationHistory: attempt as unknown as never,
        },
      },
      { new: true },
    ).exec();
    return doc ? RunMapper.toDTO(doc as unknown as RunDocument) : null;
  }

  async delete(runId: string): Promise<boolean> {
    if (!isValidObjectId(runId)) return false;
    const res = await Run.deleteOne({ _id: runId }).exec();
    return res.deletedCount > 0;
  }

  async deleteAll(): Promise<void> {
    await Run.deleteMany({}).exec();
  }
}
