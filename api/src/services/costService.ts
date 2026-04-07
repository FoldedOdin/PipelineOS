import { Run } from "../models/Run.js";

export interface StageCostAggregate {
  stageName: string;
  runs: number;
  totalCostUsd: number;
  avgCostUsd: number;
  maxCostUsd: number;
}

export const costService = {
  async topStageCosts(input: { pipelineId: string; limit: number; days: number }): Promise<StageCostAggregate[]> {
    const limit = Math.min(50, Math.max(1, Math.floor(input.limit)));
    const days = Math.min(90, Math.max(1, Math.floor(input.days)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipelineId = input.pipelineId;

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
  },
} as const;

