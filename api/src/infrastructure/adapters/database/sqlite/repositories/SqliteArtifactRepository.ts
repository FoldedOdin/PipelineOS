import type { Database } from "better-sqlite3";
import type {
  IArtifactRepository,
  ArtifactDTO,
  CreateArtifactInput,
} from "../../../../../domain/index.js";
import { SqliteArtifactMapper, type SqliteArtifactRow } from "../mappers/index.js";

export class SqliteArtifactRepository implements IArtifactRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(id: string): Promise<ArtifactDTO | null> {
    const row = this.db.prepare("SELECT * FROM artifacts WHERE id = ?").get(id) as
      | SqliteArtifactRow
      | undefined;
    return row ? SqliteArtifactMapper.toDTO(row) : null;
  }

  async findByRunId(runId: string): Promise<ArtifactDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at DESC")
      .all(runId) as SqliteArtifactRow[];
    return rows.map((r) => SqliteArtifactMapper.toDTO(r));
  }

  async create(input: CreateArtifactInput): Promise<ArtifactDTO> {
    const id =
      (input as { id?: string }).id ??
      `artifact_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowStr = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO artifacts (id, run_id, stage_name, name, size_bytes, content_type, storage_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        id,
        input.runId,
        input.stageName,
        input.name,
        input.sizeBytes,
        input.contentType,
        input.storagePath,
        nowStr,
      );

    const created = await this.findById(id);
    if (!created) {
      throw new Error("Failed to retrieve created artifact");
    }
    return created;
  }

  async delete(id: string): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM artifacts WHERE id = ?").run(id);
    return res.changes > 0;
  }

  async deleteAll(): Promise<void> {
    this.db.prepare("DELETE FROM artifacts").run();
  }
}
