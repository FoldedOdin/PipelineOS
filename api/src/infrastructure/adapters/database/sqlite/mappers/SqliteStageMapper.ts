import type { StageDTO } from "../../../../../domain/index.js";

export interface SqliteStageRow {
  id?: string;
  run_id: string;
  name: string;
  status: string;
  image: string;
  command: string;
  exit_code: number | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  logs: string;
  metrics_json: string;
}

export class SqliteStageMapper {
  static toDTO(row: SqliteStageRow): StageDTO {
    let metrics = {
      cpuSeconds: null,
      cpuPercentAvg: null,
      cpuPercentMax: null,
      memBytesMax: null,
      costUsdEstimated: null,
    };
    try {
      if (row.metrics_json) {
        const parsed = JSON.parse(row.metrics_json);
        if (parsed && typeof parsed === "object") {
          metrics = { ...metrics, ...parsed };
        }
      }
    } catch {
      // Keep defaults on parse error
    }

    return {
      name: row.name,
      status: row.status as StageDTO["status"],
      image: row.image ?? "",
      command: row.command ?? "",
      exitCode: row.exit_code ?? null,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
      durationMs: row.duration_ms ?? null,
      logs: row.logs ?? "",
      metrics,
    };
  }

  static toRow(runId: string, dto: StageDTO, id?: string): SqliteStageRow {
    return {
      id: id ?? `${runId}-${dto.name}`,
      run_id: runId,
      name: dto.name,
      status: dto.status,
      image: dto.image ?? "",
      command: dto.command ?? "",
      exit_code: dto.exitCode ?? null,
      started_at: dto.startedAt ? dto.startedAt.toISOString() : null,
      finished_at: dto.finishedAt ? dto.finishedAt.toISOString() : null,
      duration_ms: dto.durationMs ?? null,
      logs: dto.logs ?? "",
      metrics_json: JSON.stringify(dto.metrics ?? {}),
    };
  }
}
