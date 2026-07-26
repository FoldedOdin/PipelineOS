import type { Database } from "better-sqlite3";
import type {
  IRemediationRuleRepository,
  RemediationRuleDTO,
  CreateRemediationRuleInput,
  UpdateRemediationRuleInput,
} from "../../../../../domain/index.js";
import { SqliteRemediationRuleMapper, type SqliteRemediationRuleRow } from "../mappers/index.js";

export class SqliteRemediationRuleRepository implements IRemediationRuleRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(ruleId: string): Promise<RemediationRuleDTO | null> {
    const row = this.db.prepare("SELECT * FROM remediation_rules WHERE id = ?").get(ruleId) as
      | SqliteRemediationRuleRow
      | undefined;
    return row ? SqliteRemediationRuleMapper.toDTO(row) : null;
  }

  async findActive(): Promise<RemediationRuleDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM remediation_rules WHERE enabled = 1")
      .all() as SqliteRemediationRuleRow[];
    return rows.map((r) => SqliteRemediationRuleMapper.toDTO(r));
  }

  async findAll(): Promise<RemediationRuleDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM remediation_rules")
      .all() as SqliteRemediationRuleRow[];
    return rows.map((r) => SqliteRemediationRuleMapper.toDTO(r));
  }

  async create(input: CreateRemediationRuleInput): Promise<RemediationRuleDTO> {
    const id =
      (input as { id?: string }).id ??
      `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const dto: RemediationRuleDTO = {
      id,
      enabled: input.enabled ?? true,
      name: input.name,
      match: {
        pipelineId: input.match.pipelineId ?? null,
        stageName: input.match.stageName ?? null,
        anyPatterns: input.match.anyPatterns ?? [],
        anyHintSubstrings: input.match.anyHintSubstrings ?? [],
      },
      action: {
        type: input.action.type,
        maxAttempts: input.action.maxAttempts,
        backoffSeconds: input.action.backoffSeconds,
      },
      auto: {
        enabled: input.auto?.enabled ?? false,
        minAttempts: input.auto?.minAttempts ?? 10,
        disableBelowSuccessRate: input.auto?.disableBelowSuccessRate ?? 0.2,
      },
      stats: {
        attempts: input.stats?.attempts ?? 0,
        saves: input.stats?.saves ?? 0,
        failures: input.stats?.failures ?? 0,
        lastAppliedAt: input.stats?.lastAppliedAt ?? null,
        lastOutcomeAt: input.stats?.lastOutcomeAt ?? null,
      },
      createdAt: now,
      updatedAt: now,
    };

    const row = SqliteRemediationRuleMapper.toRow(dto);
    this.db
      .prepare(
        `
        INSERT INTO remediation_rules (
          id, enabled, name, pipeline_id, stage_name, match_json, action_json, auto_json, stats_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        row.id,
        row.enabled,
        row.name,
        row.pipeline_id,
        row.stage_name,
        row.match_json,
        row.action_json,
        row.auto_json,
        row.stats_json,
        row.created_at,
        row.updated_at,
      );

    const created = await this.findById(id);
    if (!created) {
      throw new Error("Failed to retrieve created remediation rule");
    }
    return created;
  }

  async update(
    ruleId: string,
    updates: UpdateRemediationRuleInput,
  ): Promise<RemediationRuleDTO | null> {
    const existing = await this.findById(ruleId);
    if (!existing) return null;

    const updatedDTO: RemediationRuleDTO = {
      ...existing,
      enabled: updates.enabled !== undefined ? updates.enabled : existing.enabled,
      name: updates.name !== undefined ? updates.name : existing.name,
      match: updates.match
        ? {
            ...existing.match,
            ...updates.match,
            anyPatterns:
              updates.match.anyPatterns !== undefined
                ? updates.match.anyPatterns
                : existing.match.anyPatterns,
            anyHintSubstrings:
              updates.match.anyHintSubstrings !== undefined
                ? updates.match.anyHintSubstrings
                : existing.match.anyHintSubstrings,
          }
        : existing.match,
      action: updates.action
        ? {
            ...existing.action,
            ...updates.action,
          }
        : existing.action,
      auto: updates.auto
        ? {
            ...existing.auto,
            ...updates.auto,
          }
        : existing.auto,
      stats: updates.stats
        ? {
            ...existing.stats,
            ...updates.stats,
          }
        : existing.stats,
      updatedAt: new Date(),
    };

    const row = SqliteRemediationRuleMapper.toRow(updatedDTO);
    this.db
      .prepare(
        `
        UPDATE remediation_rules
        SET enabled = ?, name = ?, pipeline_id = ?, stage_name = ?, match_json = ?, action_json = ?, auto_json = ?, stats_json = ?, updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        row.enabled,
        row.name,
        row.pipeline_id,
        row.stage_name,
        row.match_json,
        row.action_json,
        row.auto_json,
        row.stats_json,
        row.updated_at,
        ruleId,
      );

    return this.findById(ruleId);
  }

  async delete(ruleId: string): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM remediation_rules WHERE id = ?").run(ruleId);
    return res.changes > 0;
  }

  async deleteAll(): Promise<void> {
    this.db.prepare("DELETE FROM remediation_rules").run();
  }
}
