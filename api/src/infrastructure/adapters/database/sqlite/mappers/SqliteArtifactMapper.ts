import type { ArtifactDTO } from "../../../../../domain/index.js";

export interface SqliteArtifactRow {
  id: string;
  run_id: string;
  stage_name: string;
  name: string;
  size_bytes: number;
  content_type: string;
  storage_path: string;
  created_at: string;
}

export class SqliteArtifactMapper {
  static toDTO(row: SqliteArtifactRow): ArtifactDTO {
    return {
      id: row.id,
      runId: row.run_id,
      stageName: row.stage_name,
      name: row.name,
      sizeBytes: row.size_bytes,
      contentType: row.content_type,
      storagePath: row.storage_path,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  static toRow(dto: ArtifactDTO): SqliteArtifactRow {
    return {
      id: dto.id,
      run_id: dto.runId,
      stage_name: dto.stageName,
      name: dto.name,
      size_bytes: dto.sizeBytes,
      content_type: dto.contentType,
      storage_path: dto.storagePath,
      created_at: dto.createdAt ? dto.createdAt.toISOString() : new Date().toISOString(),
    };
  }
}
