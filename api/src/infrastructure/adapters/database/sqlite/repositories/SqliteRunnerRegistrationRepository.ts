import type { Database } from "better-sqlite3";
import type {
  IRunnerRegistrationRepository,
  RunnerRegistrationDTO,
  RegisterOrHeartbeatInput,
} from "../../../../../domain/index.js";
import {
  SqliteRunnerRegistrationMapper,
  type SqliteRunnerRegistrationRow,
} from "../mappers/index.js";

export class SqliteRunnerRegistrationRepository implements IRunnerRegistrationRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findByRunnerId(runnerId: string): Promise<RunnerRegistrationDTO | null> {
    const row = this.db
      .prepare("SELECT * FROM runner_registrations WHERE runner_id = ?")
      .get(runnerId) as SqliteRunnerRegistrationRow | undefined;
    return row ? SqliteRunnerRegistrationMapper.toDTO(row) : null;
  }

  async findAll(): Promise<RunnerRegistrationDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM runner_registrations ORDER BY updated_at DESC")
      .all() as SqliteRunnerRegistrationRow[];
    return rows.map((r) => SqliteRunnerRegistrationMapper.toDTO(r));
  }

  async registerOrHeartbeat(input: RegisterOrHeartbeatInput): Promise<RunnerRegistrationDTO> {
    const id = `runner_reg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowStr = new Date().toISOString();
    const heartbeatStr =
      input.lastHeartbeatAt instanceof Date
        ? input.lastHeartbeatAt.toISOString()
        : String(input.lastHeartbeatAt);
    const status = input.status ?? "online";

    this.db
      .prepare(
        `
        INSERT INTO runner_registrations (
          id, runner_id, last_heartbeat_at, status, version, hostname, platform, active_runs, max_concurrent_runs, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(runner_id) DO UPDATE SET
          last_heartbeat_at = excluded.last_heartbeat_at,
          status = excluded.status,
          version = COALESCE(excluded.version, runner_registrations.version),
          hostname = COALESCE(excluded.hostname, runner_registrations.hostname),
          platform = COALESCE(excluded.platform, runner_registrations.platform),
          active_runs = COALESCE(excluded.active_runs, runner_registrations.active_runs),
          max_concurrent_runs = COALESCE(excluded.max_concurrent_runs, runner_registrations.max_concurrent_runs),
          updated_at = excluded.updated_at
      `,
      )
      .run(
        id,
        input.runnerId,
        heartbeatStr,
        status,
        input.version ?? null,
        input.hostname ?? null,
        input.platform ?? null,
        input.activeRuns ?? 0,
        input.maxConcurrentRuns ?? 1,
        nowStr,
        nowStr,
      );

    const updated = await this.findByRunnerId(input.runnerId);
    if (!updated) {
      throw new Error("Failed to retrieve updated runner registration");
    }
    return updated;
  }

  async delete(runnerId: string): Promise<boolean> {
    const res = this.db
      .prepare("DELETE FROM runner_registrations WHERE runner_id = ?")
      .run(runnerId);
    return res.changes > 0;
  }

  async deleteAll(): Promise<void> {
    this.db.prepare("DELETE FROM runner_registrations").run();
  }
}
