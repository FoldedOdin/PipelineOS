import type { StageFlakinessRecordDTO, RecordStageOutcomeInput } from "../../dto/index.js";

export interface IStageFlakinessRepository {
  recordStageOutcome(input: RecordStageOutcomeInput): Promise<void>;
  findTopFlaky(limit?: number): Promise<StageFlakinessRecordDTO[]>;
  findByPipelineAndStage(pipelineId: string, stageName: string): Promise<StageFlakinessRecordDTO | null>;
  findByPipeline(pipelineId: string): Promise<StageFlakinessRecordDTO[]>;
  deleteAll(): Promise<void>;
}
