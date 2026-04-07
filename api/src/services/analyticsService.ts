import { Run } from "../models/Run.js";

export interface FailureTrendPoint {
  day: string;
  totalRuns: number;
  failedRuns: number;
  successRuns: number;
}

export const analyticsService = {
  async getFailureTrends(days: number): Promise<FailureTrendPoint[]> {
    const dayCount = Math.min(90, Math.max(1, Math.floor(days)));
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - (dayCount - 1)));
    start.setUTCHours(0, 0, 0, 0);

    const runs = await Run.find({
      createdAt: { $gte: start, $lte: end },
      status: { $in: ["success", "failed", "cancelled"] },
    })
      .select({ createdAt: 1, status: 1 })
      .lean<{ createdAt?: Date; status?: string }[]>()
      .exec();

    const buckets = new Map<string, { total: number; failed: number; success: number }>();
    for (let i = 0; i < dayCount; i += 1) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { total: 0, failed: 0, success: 0 });
    }

    for (const r of runs) {
      const created = r.createdAt instanceof Date ? r.createdAt : null;
      if (created === null) continue;
      const key = created.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b === undefined) continue;
      b.total += 1;
      if (r.status === "failed" || r.status === "cancelled") {
        b.failed += 1;
      } else if (r.status === "success") {
        b.success += 1;
      }
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({
        day,
        totalRuns: v.total,
        failedRuns: v.failed,
        successRuns: v.success,
      }));
  },
} as const;
