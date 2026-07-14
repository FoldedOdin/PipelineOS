import type { StageDTO } from "../../../../../domain/index.js";
import type { RunStageResult as MongoStageResult } from "../../../../../models/Run.js";

export class StageMapper {
  static toDTO(doc: MongoStageResult): StageDTO {
    return {
      name: doc.name,
      status: doc.status,
      image: doc.image,
      command: doc.command,
      exitCode: doc.exitCode ?? null,
      startedAt: doc.startedAt ? new Date(doc.startedAt) : null,
      finishedAt: doc.finishedAt ? new Date(doc.finishedAt) : null,
      durationMs: doc.durationMs ?? null,
      logs: doc.logs ?? "",
      metrics: {
        cpuSeconds: doc.metrics?.cpuSeconds ?? null,
        cpuPercentAvg: doc.metrics?.cpuPercentAvg ?? null,
        cpuPercentMax: doc.metrics?.cpuPercentMax ?? null,
        memBytesMax: doc.metrics?.memBytesMax ?? null,
        costUsdEstimated: doc.metrics?.costUsdEstimated ?? null,
      },
    };
  }

  static toMongo(dto: StageDTO): MongoStageResult {
    return {
      name: dto.name,
      status: dto.status,
      image: dto.image,
      command: dto.command,
      exitCode: dto.exitCode ?? null,
      startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
      finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : null,
      durationMs: dto.durationMs ?? null,
      logs: dto.logs ?? "",
      metrics: {
        cpuSeconds: dto.metrics?.cpuSeconds ?? null,
        cpuPercentAvg: dto.metrics?.cpuPercentAvg ?? null,
        cpuPercentMax: dto.metrics?.cpuPercentMax ?? null,
        memBytesMax: dto.metrics?.memBytesMax ?? null,
        costUsdEstimated: dto.metrics?.costUsdEstimated ?? null,
      },
    };
  }
}
