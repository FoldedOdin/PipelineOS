export interface StageOutcomeDTO {
  runId: string;
  success: boolean;
  at: Date;
}

export interface StageFlakinessRecordDTO {
  id: string;
  pipelineId: string;
  stageName: string;
  outcomes: StageOutcomeDTO[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordStageOutcomeInput {
  pipelineId: string;
  stageName: string;
  runId: string;
  success: boolean;
  at: Date;
}
