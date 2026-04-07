import mongoose, { type Types } from "mongoose";
import { StageFlakinessRecord } from "../models/StageFlakinessRecord.js";

export const MAX_OUTCOMES_PER_STAGE = 50;

export interface StageFlakinessScore {
  pipelineId: string;
  stageName: string;
  windowSize: number;
  passes: number;
  fails: number;
  /** 0–1; higher means more mixed pass/fail (unstable). 0 if all pass or all fail. */
  flakeScore: number;
  updatedAt: string | null;
}

function computeFlakeScore(passes: number, fails: number): number {
  const total = passes + fails;
  if (total === 0) return 0;
  if (passes === 0 || fails === 0) return 0;
  return (2 * Math.min(passes, fails)) / total;
}

export const flakinessService = {
  async recordOutcome(input: {
    pipelineId: string;
    stageName: string;
    runId: Types.ObjectId | string;
    success: boolean;
  }): Promise<void> {
    const runId =
      typeof input.runId === "string"
        ? new mongoose.Types.ObjectId(input.runId)
        : input.runId;
    const at = new Date();

    await StageFlakinessRecord.findOneAndUpdate(
      { pipelineId: input.pipelineId, stageName: input.stageName },
      {
        $push: {
          outcomes: {
            $each: [{ runId, success: input.success, at }],
            $slice: -MAX_OUTCOMES_PER_STAGE,
          },
        },
      },
      { upsert: true, new: true },
    ).exec();
  },

  async listScoresForPipeline(pipelineId: string): Promise<StageFlakinessScore[]> {
    const docs = await StageFlakinessRecord.find({ pipelineId })
      .sort({ stageName: 1 })
      .lean<
        {
          pipelineId: string;
          stageName: string;
          outcomes: { success: boolean }[];
          updatedAt?: Date;
        }[]
      >()
      .exec();

    return docs.map((d) => {
      const passes = d.outcomes.filter((o) => o.success).length;
      const fails = d.outcomes.length - passes;
      return {
        pipelineId: d.pipelineId,
        stageName: d.stageName,
        windowSize: d.outcomes.length,
        passes,
        fails,
        flakeScore: computeFlakeScore(passes, fails),
        updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : null,
      };
    });
  },

  /**
   * Heatmap cells: per stage, per UTC calendar day (last `days`), flake score from outcomes that landed that day.
   */
  async getHeatmap(
    pipelineId: string,
    days: number,
  ): Promise<{
    days: string[];
    stages: { stageName: string; cells: (number | null)[] }[];
  }> {
    const dayCount = Math.min(30, Math.max(1, Math.floor(days)));
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const dayKeys: string[] = [];
    for (let i = dayCount - 1; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i));
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
    }

    const docs = await StageFlakinessRecord.find({ pipelineId })
      .sort({ stageName: 1 })
      .lean<
        {
          stageName: string;
          outcomes: { success: boolean; at: Date }[];
        }[]
      >()
      .exec();

    const stages = docs.map((doc) => {
      const cells: (number | null)[] = dayKeys.map((dayKey) => {
        const inDay = doc.outcomes.filter((o) => {
          if (!(o.at instanceof Date)) return false;
          return o.at.toISOString().slice(0, 10) === dayKey;
        });
        if (inDay.length === 0) return null;
        const passes = inDay.filter((o) => o.success).length;
        const fails = inDay.length - passes;
        return computeFlakeScore(passes, fails);
      });
      return { stageName: doc.stageName, cells };
    });

    return { days: dayKeys, stages };
  },
} as const;
