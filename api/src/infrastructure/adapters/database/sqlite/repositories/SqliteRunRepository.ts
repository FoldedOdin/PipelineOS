import type { Database } from "better-sqlite3";
import type {
  IRunRepository,
  RunDTO,
  CreateRunInput,
  UpdateRunInput,
  RemediationAttemptDTO,
  StageCostAggregateDTO,
} from "../../../../../domain/index.js";

import {
  SqliteRunMapper,
  type SqliteRunRow,
  SqliteStageMapper,
  type SqliteStageRow,
} from "../mappers/index.js";

export class SqliteRunRepository implements IRunRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  private rowToDTO(row: SqliteRunRow): RunDTO {
    const stageRows = this.db
      .prepare("SELECT * FROM stages WHERE run_id = ? ORDER BY rowid ASC")
      .all(row.id) as SqliteStageRow[];
    const stages = stageRows.map((s) => SqliteStageMapper.toDTO(s));
    return SqliteRunMapper.toDTO(row, stages);
  }

  async findById(runId: string): Promise<RunDTO | null> {
    const row = this.db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as
      | SqliteRunRow
      | undefined;
    return row ? this.rowToDTO(row) : null;
  }

  async findByPipeline(pipelineId: string, limit = 20): Promise<RunDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM runs WHERE pipeline_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(pipelineId, limit) as SqliteRunRow[];
    return rows.map((r) => this.rowToDTO(r));
  }

  async findRecent(options?: { limit?: number; since?: string }): Promise<RunDTO[]> {
    const limit = options?.limit ?? 50;
    if (options?.since) {
      const rows = this.db
        .prepare("SELECT * FROM runs WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?")
        .all(options.since, limit) as SqliteRunRow[];
      return rows.map((r) => this.rowToDTO(r));
    }
    const rows = this.db
      .prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?")
      .all(limit) as SqliteRunRow[];
    return rows.map((r) => this.rowToDTO(r));
  }

  async countAll(): Promise<number> {
    const res = this.db.prepare("SELECT COUNT(*) as count FROM runs").get() as { count: number };
    return res.count;
  }

  async findPaginated(options: { skip?: number; limit?: number }): Promise<RunDTO[]> {
    const skip = options.skip ?? 0;
    const limit = options.limit ?? 20;
    const rows = this.db
      .prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .all(limit, skip) as SqliteRunRow[];
    return rows.map((r) => this.rowToDTO(r));
  }

  async findDistinctPipelines(): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT DISTINCT pipeline_id FROM runs ORDER BY pipeline_id ASC")
      .all() as { pipeline_id: string }[];
    return rows.map((r) => r.pipeline_id);
  }

  async findStaleRuns(staleBefore: Date, limit = 50): Promise<RunDTO[]> {
    const staleStr = staleBefore.toISOString();
    const rows = this.db
      .prepare(
        `
        SELECT * FROM runs
        WHERE status = 'running'
          AND (
            (last_heartbeat_at IS NOT NULL AND last_heartbeat_at < ?)
            OR (last_heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < ?)
            OR (last_heartbeat_at IS NULL AND started_at IS NULL AND created_at < ?)
          )
        ORDER BY created_at ASC
        LIMIT ?
      `,
      )
      .all(staleStr, staleStr, staleStr, limit) as SqliteRunRow[];
    return rows.map((r) => this.rowToDTO(r));
  }

  async topStageCosts(
    pipelineId: string,
    limit: number,
    since: Date,
  ): Promise<StageCostAggregateDTO[]> {
    const sinceStr = since.toISOString();
    const rows = this.db
      .prepare(
        `
        SELECT 
          s.name AS stageName,
          COUNT(*) AS runs,
          SUM(CAST(json_extract(s.metrics_json, '$.costUsdEstimated') AS REAL)) AS totalCostUsd,
          AVG(CAST(json_extract(s.metrics_json, '$.costUsdEstimated') AS REAL)) AS avgCostUsd,
          MAX(CAST(json_extract(s.metrics_json, '$.costUsdEstimated') AS REAL)) AS maxCostUsd
        FROM stages s
        JOIN runs r ON s.run_id = r.id
        WHERE r.pipeline_id = ? AND r.created_at >= ? AND json_extract(s.metrics_json, '$.costUsdEstimated') IS NOT NULL
        GROUP BY s.name
        ORDER BY totalCostUsd DESC
        LIMIT ?
      `,
      )
      .all(pipelineId, sinceStr, limit) as {
      stageName: string;
      runs: number;
      totalCostUsd: number;
      avgCostUsd: number;
      maxCostUsd: number;
    }[];

    return rows.map((r) => ({
      stageName: r.stageName,
      runs: r.runs,
      totalCostUsd: r.totalCostUsd ?? 0,
      avgCostUsd: r.avgCostUsd ?? 0,
      maxCostUsd: r.maxCostUsd ?? 0,
    }));
  }

  async findAssignedRuns(): Promise<RunDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM runs WHERE status = 'running' AND claimed_by IS NOT NULL")
      .all() as SqliteRunRow[];
    return rows.map((r) => this.rowToDTO(r));
  }

  async create(input: CreateRunInput): Promise<RunDTO> {
    const runId = input.id ?? `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowStr = new Date().toISOString();
    const status = input.status ?? "queued";

    const stages = input.stages ?? [];

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `
          INSERT INTO runs (
            id, pipeline_id, commit_sha, branch, triggered_by, event, status,
            started_at, finished_at, duration_ms, last_heartbeat_at,
            claimed_by, claim_expires_at, remediation_history_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, null, null, null, null, null, null, '[]', ?)
        `,
        )
        .run(
          runId,
          input.pipelineId,
          input.commitSha,
          input.branch,
          input.triggeredBy,
          input.event,
          status,
          nowStr,
        );

      const stageInsert = this.db.prepare(`
        INSERT INTO stages (
          id, run_id, name, status, image, command, exit_code,
          started_at, finished_at, duration_ms, logs, metrics_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of stages) {
        const row = SqliteStageMapper.toRow(runId, s);
        stageInsert.run(
          row.id,
          row.run_id,
          row.name,
          row.status,
          row.image,
          row.command,
          row.exit_code,
          row.started_at,
          row.finished_at,
          row.duration_ms,
          row.logs,
          row.metrics_json,
        );
      }
    });

    tx();

    const created = await this.findById(runId);
    if (!created) {
      throw new Error("Failed to retrieve created run");
    }
    return created;
  }

  async update(runId: string, updates: UpdateRunInput): Promise<RunDTO | null> {
    const existing = await this.findById(runId);
    if (!existing) return null;

    const updatedDTO: RunDTO = {
      ...existing,
      status: updates.status !== undefined ? updates.status : existing.status,
      startedAt: updates.startedAt !== undefined ? (updates.startedAt ?? null) : existing.startedAt,
      finishedAt:
        updates.finishedAt !== undefined ? (updates.finishedAt ?? null) : existing.finishedAt,
      durationMs:
        updates.durationMs !== undefined ? (updates.durationMs ?? null) : existing.durationMs,
      lastHeartbeatAt:
        updates.lastHeartbeatAt !== undefined
          ? (updates.lastHeartbeatAt ?? null)
          : existing.lastHeartbeatAt,
      claimedBy: updates.claimedBy !== undefined ? (updates.claimedBy ?? null) : existing.claimedBy,
      claimExpiresAt:
        updates.claimExpiresAt !== undefined
          ? (updates.claimExpiresAt ?? null)
          : existing.claimExpiresAt,
      remediationHistory:
        updates.remediationHistory !== undefined
          ? updates.remediationHistory
          : existing.remediationHistory,
    };

    const row = SqliteRunMapper.toRow(updatedDTO);

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `
          UPDATE runs
          SET status = ?, started_at = ?, finished_at = ?, duration_ms = ?,
              last_heartbeat_at = ?, claimed_by = ?, claim_expires_at = ?,
              remediation_history_json = ?
          WHERE id = ?
        `,
        )
        .run(
          row.status,
          row.started_at,
          row.finished_at,
          row.duration_ms,
          row.last_heartbeat_at,
          row.claimed_by,
          row.claim_expires_at,
          row.remediation_history_json,
          runId,
        );

      if (updates.stages !== undefined) {
        this.db.prepare("DELETE FROM stages WHERE run_id = ?").run(runId);
        const stageInsert = this.db.prepare(`
          INSERT INTO stages (
            id, run_id, name, status, image, command, exit_code,
            started_at, finished_at, duration_ms, logs, metrics_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const s of updates.stages) {
          const sRow = SqliteStageMapper.toRow(runId, s);
          stageInsert.run(
            sRow.id,
            sRow.run_id,
            sRow.name,
            sRow.status,
            sRow.image,
            sRow.command,
            sRow.exit_code,
            sRow.started_at,
            sRow.finished_at,
            sRow.duration_ms,
            sRow.logs,
            sRow.metrics_json,
          );
        }
      }
    });

    tx();

    return this.findById(runId);
  }

  async claimNextQueuedRun(runnerId: string, assignedAt: string): Promise<RunDTO | null> {
    const now = new Date(assignedAt);
    const nowStr = now.toISOString();
    const leaseUntil = new Date(now.getTime() + 60 * 1000).toISOString();

    const tx = this.db.transaction(() => {
      const candidate = this.db
        .prepare(
          `
          SELECT * FROM runs
          WHERE status = 'queued'
             OR (claim_expires_at IS NOT NULL AND claim_expires_at <= ?)
          ORDER BY created_at ASC
          LIMIT 1
        `,
        )
        .get(nowStr) as SqliteRunRow | undefined;

      if (!candidate) {
        return null;
      }

      this.db
        .prepare(
          `
          UPDATE runs
          SET status = 'running',
              started_at = COALESCE(started_at, ?),
              last_heartbeat_at = ?,
              claimed_by = ?,
              claim_expires_at = ?
          WHERE id = ?
        `,
        )
        .run(nowStr, nowStr, runnerId, leaseUntil, candidate.id);

      const updatedRow = this.db
        .prepare("SELECT * FROM runs WHERE id = ?")
        .get(candidate.id) as SqliteRunRow;
      return this.rowToDTO(updatedRow);
    });

    return tx();
  }

  async addRemediationHistory(
    runId: string,
    attempt: RemediationAttemptDTO,
  ): Promise<RunDTO | null> {
    const existing = await this.findById(runId);
    if (!existing) return null;

    const history = existing.remediationHistory ? [...existing.remediationHistory] : [];
    history.push(attempt);

    this.db
      .prepare("UPDATE runs SET remediation_history_json = ? WHERE id = ?")
      .run(JSON.stringify(history), runId);

    return this.findById(runId);
  }

  async delete(runId: string): Promise<boolean> {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM stages WHERE run_id = ?").run(runId);
      const res = this.db.prepare("DELETE FROM runs WHERE id = ?").run(runId);
      return res.changes > 0;
    });
    return tx();
  }

  async deleteAll(): Promise<void> {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM stages").run();
      this.db.prepare("DELETE FROM runs").run();
    });
    tx();
  }
}
