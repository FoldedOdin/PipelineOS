import type { Database } from "better-sqlite3";
import type {
  IPipelineRepository,
  PipelineDTO,
  CreatePipelineInput,
  UpdatePipelineInput,
} from "../../../../../domain/index.js";
import { SqlitePipelineMapper, type SqlitePipelineRow } from "../mappers/index.js";

export class SqlitePipelineRepository implements IPipelineRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(pipelineId: string): Promise<PipelineDTO | null> {
    const row = this.db.prepare("SELECT * FROM pipelines WHERE pipeline_id = ?").get(pipelineId) as
      | SqlitePipelineRow
      | undefined;
    return row ? SqlitePipelineMapper.toDTO(row) : null;
  }

  async findAll(): Promise<PipelineDTO[]> {
    const rows = this.db
      .prepare("SELECT * FROM pipelines ORDER BY updated_at DESC")
      .all() as SqlitePipelineRow[];
    return rows.map((r) => SqlitePipelineMapper.toDTO(r));
  }

  async create(input: CreatePipelineInput): Promise<PipelineDTO> {
    const nowStr = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT INTO pipelines (pipeline_id, ref_sha, raw_yaml, updated_at)
        VALUES (?, ?, ?, ?)
      `,
      )
      .run(input.pipelineId, input.refSha, input.rawYaml, nowStr);

    const created = await this.findById(input.pipelineId);
    if (!created) {
      throw new Error("Failed to retrieve created pipeline");
    }
    return created;
  }

  async update(pipelineId: string, updates: UpdatePipelineInput): Promise<PipelineDTO | null> {
    const existing = await this.findById(pipelineId);
    if (!existing) return null;

    const updatedDTO: PipelineDTO = {
      ...existing,
      refSha: updates.refSha !== undefined ? updates.refSha : existing.refSha,
      rawYaml: updates.rawYaml !== undefined ? updates.rawYaml : existing.rawYaml,
      updatedAt: updates.updatedAt !== undefined ? updates.updatedAt : new Date(),
    };

    const row = SqlitePipelineMapper.toRow(updatedDTO);
    this.db
      .prepare(
        `
        UPDATE pipelines
        SET ref_sha = ?, raw_yaml = ?, updated_at = ?
        WHERE pipeline_id = ?
      `,
      )
      .run(row.ref_sha, row.raw_yaml, row.updated_at, pipelineId);

    return this.findById(pipelineId);
  }

  async upsertSummaryStats(
    pipelineId: string,
    refSha: string,
    rawYaml: string,
  ): Promise<PipelineDTO> {
    const nowStr = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT INTO pipelines (pipeline_id, ref_sha, raw_yaml, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(pipeline_id) DO UPDATE SET
          ref_sha = excluded.ref_sha,
          raw_yaml = excluded.raw_yaml,
          updated_at = excluded.updated_at
      `,
      )
      .run(pipelineId, refSha, rawYaml, nowStr);

    const upserted = await this.findById(pipelineId);
    if (!upserted) {
      throw new Error("Failed to retrieve upserted pipeline");
    }
    return upserted;
  }

  async delete(pipelineId: string): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM pipelines WHERE pipeline_id = ?").run(pipelineId);
    return res.changes > 0;
  }

  async deleteAll(): Promise<void> {
    this.db.prepare("DELETE FROM pipelines").run();
  }
}
