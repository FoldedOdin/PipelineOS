import type { StageFlakinessRecordDTO, StageOutcomeDTO } from "../../../../../domain/index.js";

export interface SqliteStageFlakinessRow {
  id: string;
  pipeline_id: string;
  stage_name: string;
  outcomes_json: string;
  created_at: string;
  updated_at: string;
}

export class SqliteStageFlakinessMapper {
  static toDTO(row: SqliteStageFlakinessRow): StageFlakinessRecordDTO {
    let outcomes: StageOutcomeDTO[] = [];
    try {
      if (row.outcomes_json) {
        const parsed = JSON.parse(row.outcomes_json);
        if (Array.isArray(parsed)) {
          outcomes = parsed.map((o: unknown) => {
            const item = o as Record<string, unknown>;
            return {
              runId: typeof item.runId === "string" ? item.runId : String(item.runId || ""),
              success: Boolean(item.success),
              at: typeof item.at === "string" ? new Date(item.at) : new Date(),
            };
          });
        }
      }
    } catch {
      outcomes = [];
    }

    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      stageName: row.stage_name,
      outcomes,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  static toRow(dto: StageFlakinessRecordDTO): SqliteStageFlakinessRow {
    return {
      id: dto.id,
      pipeline_id: dto.pipelineId,
      stage_name: dto.stageName,
      outcomes_json: JSON.stringify(
        (dto.outcomes ?? []).map((o) => ({
          runId: o.runId,
          success: o.success,
          at: o.at instanceof Date ? o.at.toISOString() : String(o.at),
        }))
      ),
      created_at: dto.createdAt ? dto.createdAt.toISOString() : new Date().toISOString(),
      updated_at: dto.updatedAt ? dto.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
