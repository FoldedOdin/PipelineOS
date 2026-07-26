import type { StageDTO, UpdateStageStatusInput } from "../../dto/index.js";

export interface IStageRepository {
  findByRunId(runId: string): Promise<StageDTO[]>;
  findStage(runId: string, stageName: string): Promise<StageDTO | null>;
  updateStatus(
    runId: string,
    stageName: string,
    input: UpdateStageStatusInput,
  ): Promise<StageDTO | null>;
}
