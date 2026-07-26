import type { RunnerRegistrationDTO } from "../../../../../domain/index.js";

export interface SqliteRunnerRegistrationRow {
  id: string;
  runner_id: string;
  last_heartbeat_at: string;
  status: string;
  version: string | null;
  hostname: string | null;
  platform: string | null;
  active_runs: number;
  max_concurrent_runs: number;
  created_at: string;
  updated_at: string;
}

export class SqliteRunnerRegistrationMapper {
  static toDTO(row: SqliteRunnerRegistrationRow): RunnerRegistrationDTO {
    return {
      id: row.id,
      runnerId: row.runner_id,
      lastHeartbeatAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at) : new Date(),
      status: row.status as "online" | "offline",
      version: row.version ?? undefined,
      hostname: row.hostname ?? undefined,
      platform: row.platform ?? undefined,
      activeRuns: row.active_runs ?? 0,
      maxConcurrentRuns: row.max_concurrent_runs ?? 1,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }

  static toRow(dto: RunnerRegistrationDTO): SqliteRunnerRegistrationRow {
    return {
      id: dto.id,
      runner_id: dto.runnerId,
      last_heartbeat_at: dto.lastHeartbeatAt
        ? dto.lastHeartbeatAt.toISOString()
        : new Date().toISOString(),
      status: dto.status,
      version: dto.version ?? null,
      hostname: dto.hostname ?? null,
      platform: dto.platform ?? null,
      active_runs: dto.activeRuns ?? 0,
      max_concurrent_runs: dto.maxConcurrentRuns ?? 1,
      created_at: dto.createdAt ? dto.createdAt.toISOString() : new Date().toISOString(),
      updated_at: dto.updatedAt ? dto.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
