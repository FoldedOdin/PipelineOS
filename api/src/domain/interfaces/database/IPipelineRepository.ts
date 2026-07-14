import type { PipelineDTO, CreatePipelineInput, UpdatePipelineInput } from "../../dto/index.js";

export interface IPipelineRepository {
  findById(pipelineId: string): Promise<PipelineDTO | null>;
  findAll(): Promise<PipelineDTO[]>;
  create(input: CreatePipelineInput): Promise<PipelineDTO>;
  update(pipelineId: string, updates: UpdatePipelineInput): Promise<PipelineDTO | null>;
  upsertSummaryStats(pipelineId: string, refSha: string, rawYaml: string): Promise<PipelineDTO>;
  delete(pipelineId: string): Promise<boolean>;
  deleteAll(): Promise<void>;
}
