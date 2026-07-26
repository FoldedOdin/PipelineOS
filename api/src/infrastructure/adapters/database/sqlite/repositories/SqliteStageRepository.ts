import type { Database } from "better-sqlite3";
import type {
  IStageRepository,
  StageDTO,
  UpdateStageStatusInput,
} from "../../../../../domain/index.js";
import { SqliteStageMapper, type SqliteStageRow } from "../mappers/index.js";

export class SqliteStageRepository implements IStageRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findByRunId(runId: string): Promise<StageDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM stages WHERE run_id = ? ORDER BY rowid ASC")
      .all(runId) as SqliteStageRow[];
    return rows.map((row) => SqliteStageMapper.toDTO(row));
  }

  async findStage(runId: string, stageName: string): Promise<StageDTO | null> {
    const row = this.db
      .prepare("SELECT * FROM stages WHERE run_id = ? AND name = ?")
      .get(runId, stageName) as SqliteStageRow | undefined;
    return row ? SqliteStageMapper.toDTO(row) : null;
  }

  async updateStatus(
    runId: string,
    stageName: string,
    input: UpdateStageStatusInput,
  ): Promise<StageDTO | null> {
    const existing = await this.findStage(runId, stageName);
    if (!existing) {
      return null;
    }

    const updatedDTO: StageDTO = {
      ...existing,
      status: input.status,
      exitCode: input.exitCode !== undefined ? (input.exitCode ?? null) : existing.exitCode,
      startedAt: input.startedAt !== undefined ? (input.startedAt ?? null) : existing.startedAt,
      finishedAt: input.finishedAt !== undefined ? (input.finishedAt ?? null) : existing.finishedAt,
      durationMs: input.durationMs !== undefined ? (input.durationMs ?? null) : existing.durationMs,
      metrics: input.metrics
        ? {
            cpuSeconds:
              input.metrics.cpuSeconds !== undefined
                ? (input.metrics.cpuSeconds ?? null)
                : existing.metrics.cpuSeconds,
            cpuPercentAvg:
              input.metrics.cpuPercentAvg !== undefined
                ? (input.metrics.cpuPercentAvg ?? null)
                : existing.metrics.cpuPercentAvg,
            cpuPercentMax:
              input.metrics.cpuPercentMax !== undefined
                ? (input.metrics.cpuPercentMax ?? null)
                : existing.metrics.cpuPercentMax,
            memBytesMax:
              input.metrics.memBytesMax !== undefined
                ? (input.metrics.memBytesMax ?? null)
                : existing.metrics.memBytesMax,
            costUsdEstimated:
              input.metrics.costUsdEstimated !== undefined
                ? (input.metrics.costUsdEstimated ?? null)
                : existing.metrics.costUsdEstimated,
          }
        : existing.metrics,
    };

    const row = SqliteStageMapper.toRow(runId, updatedDTO);
    this.db
      .prepare(
        `
      UPDATE stages
      SET status = ?, exit_code = ?, started_at = ?, finished_at = ?, duration_ms = ?, metrics_json = ?
      WHERE run_id = ? AND name = ?
    `,
      )
      .run(
        row.status,
        row.exit_code,
        row.started_at,
        row.finished_at,
        row.duration_ms,
        row.metrics_json,
        runId,
        stageName,
      );

    return updatedDTO;
  }
}
