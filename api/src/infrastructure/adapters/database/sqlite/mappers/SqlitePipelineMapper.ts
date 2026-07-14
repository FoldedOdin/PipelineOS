import type { PipelineDTO } from "../../../../../domain/index.js";

export interface SqlitePipelineRow {
  pipeline_id: string;
  ref_sha: string;
  raw_yaml: string;
  updated_at: string;
}

export class SqlitePipelineMapper {
  static toDTO(row: SqlitePipelineRow): PipelineDTO {
    return {
      pipelineId: row.pipeline_id,
      refSha: row.ref_sha,
      rawYaml: row.raw_yaml,
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  static toRow(dto: PipelineDTO): SqlitePipelineRow {
    return {
      pipeline_id: dto.pipelineId,
      ref_sha: dto.refSha,
      raw_yaml: dto.rawYaml,
      updated_at: dto.updatedAt ? dto.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
