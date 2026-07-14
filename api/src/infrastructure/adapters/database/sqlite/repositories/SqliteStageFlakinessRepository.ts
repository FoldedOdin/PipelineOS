import type { Database } from "better-sqlite3";
import type {
  IStageFlakinessRepository,
  StageFlakinessRecordDTO,
  RecordStageOutcomeInput,
} from "../../../../../domain/index.js";
import { SqliteStageFlakinessMapper, type SqliteStageFlakinessRow } from "../mappers/index.js";

const MAX_OUTCOMES_PER_STAGE = 50;

export class SqliteStageFlakinessRepository implements IStageFlakinessRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async recordStageOutcome(input: RecordStageOutcomeInput): Promise<void> {
    const tx = this.db.transaction(() => {
      const existing = this.db
        .prepare("SELECT * FROM stage_flakiness_records WHERE pipeline_id = ? AND stage_name = ?")
        .get(input.pipelineId, input.stageName) as SqliteStageFlakinessRow | undefined;

      let outcomes: { runId: string; success: boolean; at: string }[] = [];
      let id = `flakiness_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const nowStr = new Date().toISOString();
      let createdAtStr = nowStr;

      if (existing) {
        id = existing.id;
        createdAtStr = existing.created_at || nowStr;
        try {
          outcomes = JSON.parse(existing.outcomes_json || "[]");
        } catch {
          outcomes = [];
        }
      }

      const atStr = input.at instanceof Date ? input.at.toISOString() : String(input.at);
      outcomes.push({
        runId: input.runId,
        success: input.success,
        at: atStr,
      });

      if (outcomes.length > MAX_OUTCOMES_PER_STAGE) {
        outcomes = outcomes.slice(-MAX_OUTCOMES_PER_STAGE);
      }

      this.db
        .prepare(`
          INSERT INTO stage_flakiness_records (id, pipeline_id, stage_name, outcomes_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(pipeline_id, stage_name) DO UPDATE SET
            outcomes_json = excluded.outcomes_json,
            updated_at = excluded.updated_at
        `)
        .run(id, input.pipelineId, input.stageName, JSON.stringify(outcomes), createdAtStr, nowStr);
    });

    tx();
  }

  async findTopFlaky(limit = 50): Promise<StageFlakinessRecordDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM stage_flakiness_records ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as SqliteStageFlakinessRow[];
    return rows.map((r) => SqliteStageFlakinessMapper.toDTO(r));
  }

  async findByPipelineAndStage(pipelineId: string, stageName: string): Promise<StageFlakinessRecordDTO | null> {
    const row = this.db
      .prepare("SELECT * FROM stage_flakiness_records WHERE pipeline_id = ? AND stage_name = ?")
      .get(pipelineId, stageName) as SqliteStageFlakinessRow | undefined;
    return row ? SqliteStageFlakinessMapper.toDTO(row) : null;
  }

  async findByPipeline(pipelineId: string): Promise<StageFlakinessRecordDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM stage_flakiness_records WHERE pipeline_id = ? ORDER BY stage_name ASC")
      .all(pipelineId) as SqliteStageFlakinessRow[];
    return rows.map((r) => SqliteStageFlakinessMapper.toDTO(r));
  }

  async deleteAll(): Promise<void> {
    this.db.prepare("DELETE FROM stage_flakiness_records").run();
  }
}
