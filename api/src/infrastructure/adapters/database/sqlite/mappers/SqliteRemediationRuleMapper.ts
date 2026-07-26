import type { RemediationRuleDTO } from "../../../../../domain/index.js";

export interface SqliteRemediationRuleRow {
  id: string;
  enabled: number;
  name: string;
  pipeline_id: string | null;
  stage_name: string | null;
  match_json: string;
  action_json: string;
  auto_json: string;
  stats_json: string;
  created_at: string;
  updated_at: string;
}

export class SqliteRemediationRuleMapper {
  static toDTO(row: SqliteRemediationRuleRow): RemediationRuleDTO {
    const match = JSON.parse(row.match_json || "{}");
    const action = JSON.parse(row.action_json || "{}");
    const auto = JSON.parse(row.auto_json || "{}");
    const stats = JSON.parse(row.stats_json || "{}");

    return {
      id: row.id,
      enabled: Boolean(row.enabled),
      name: row.name,
      match: {
        pipelineId: row.pipeline_id ?? match.pipelineId ?? null,
        stageName: row.stage_name ?? match.stageName ?? null,
        anyPatterns: Array.isArray(match.anyPatterns) ? match.anyPatterns : [],
        anyHintSubstrings: Array.isArray(match.anyHintSubstrings) ? match.anyHintSubstrings : [],
      },
      action: {
        type: action.type === "retry_stage" ? "retry_stage" : "retry_stage",
        maxAttempts: typeof action.maxAttempts === "number" ? action.maxAttempts : 2,
        backoffSeconds: typeof action.backoffSeconds === "number" ? action.backoffSeconds : 5,
      },
      auto: {
        enabled: Boolean(auto.enabled),
        minAttempts: typeof auto.minAttempts === "number" ? auto.minAttempts : 10,
        disableBelowSuccessRate:
          typeof auto.disableBelowSuccessRate === "number" ? auto.disableBelowSuccessRate : 0.2,
      },
      stats: {
        attempts: typeof stats.attempts === "number" ? stats.attempts : 0,
        saves: typeof stats.saves === "number" ? stats.saves : 0,
        failures: typeof stats.failures === "number" ? stats.failures : 0,
        lastAppliedAt: stats.lastAppliedAt ? new Date(stats.lastAppliedAt) : null,
        lastOutcomeAt: stats.lastOutcomeAt ? new Date(stats.lastOutcomeAt) : null,
      },
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  static toRow(dto: RemediationRuleDTO): SqliteRemediationRuleRow {
    return {
      id: dto.id,
      enabled: dto.enabled ? 1 : 0,
      name: dto.name,
      pipeline_id: dto.match.pipelineId,
      stage_name: dto.match.stageName,
      match_json: JSON.stringify({
        pipelineId: dto.match.pipelineId,
        stageName: dto.match.stageName,
        anyPatterns: dto.match.anyPatterns,
        anyHintSubstrings: dto.match.anyHintSubstrings,
      }),
      action_json: JSON.stringify(dto.action),
      auto_json: JSON.stringify(dto.auto),
      stats_json: JSON.stringify({
        attempts: dto.stats.attempts,
        saves: dto.stats.saves,
        failures: dto.stats.failures,
        lastAppliedAt: dto.stats.lastAppliedAt ? dto.stats.lastAppliedAt.toISOString() : null,
        lastOutcomeAt: dto.stats.lastOutcomeAt ? dto.stats.lastOutcomeAt.toISOString() : null,
      }),
      created_at: dto.createdAt ? dto.createdAt.toISOString() : new Date().toISOString(),
      updated_at: dto.updatedAt ? dto.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
