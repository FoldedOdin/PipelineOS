import type {
  IPipelineRepository,
  PipelineDTO,
  CreatePipelineInput,
  UpdatePipelineInput,
} from "../../../../../domain/index.js";
import { Pipeline, type PipelineDocument } from "../../../../../models/Pipeline.js";
import { PipelineMapper } from "../mappers/index.js";

export class MongoPipelineRepository implements IPipelineRepository {
  async findById(pipelineId: string): Promise<PipelineDTO | null> {
    const doc = await Pipeline.findOne({ pipelineId }).exec();
    return doc ? PipelineMapper.toDTO(doc as unknown as PipelineDocument) : null;
  }

  async findAll(): Promise<PipelineDTO[]> {
    const docs = await Pipeline.find().exec();
    return docs.map((d: unknown) => PipelineMapper.toDTO(d as PipelineDocument));
  }

  async create(input: CreatePipelineInput): Promise<PipelineDTO> {
    const doc = await Pipeline.create({
      pipelineId: input.pipelineId,
      refSha: input.refSha,
      rawYaml: input.rawYaml,
      updatedAt: new Date(),
    });
    return PipelineMapper.toDTO(doc as unknown as PipelineDocument);
  }

  async update(pipelineId: string, updates: UpdatePipelineInput): Promise<PipelineDTO | null> {
    const setFields: Record<string, unknown> = {};
    if (updates.refSha !== undefined) setFields.refSha = updates.refSha;
    if (updates.rawYaml !== undefined) setFields.rawYaml = updates.rawYaml;
    if (updates.updatedAt !== undefined) setFields.updatedAt = updates.updatedAt;

    const doc = await Pipeline.findOneAndUpdate(
      { pipelineId },
      { $set: setFields },
      { new: true }
    ).exec();
    return doc ? PipelineMapper.toDTO(doc as unknown as PipelineDocument) : null;
  }

  async upsertSummaryStats(pipelineId: string, refSha: string, rawYaml: string): Promise<PipelineDTO> {
    const doc = await Pipeline.findOneAndUpdate(
      { pipelineId },
      { $set: { pipelineId, refSha, rawYaml, updatedAt: new Date() } },
      { upsert: true, new: true }
    ).exec();
    return PipelineMapper.toDTO(doc as unknown as PipelineDocument);
  }

  async delete(pipelineId: string): Promise<boolean> {
    const res = await Pipeline.deleteOne({ pipelineId }).exec();
    return res.deletedCount > 0;
  }

  async deleteAll(): Promise<void> {
    await Pipeline.deleteMany({}).exec();
  }
}
