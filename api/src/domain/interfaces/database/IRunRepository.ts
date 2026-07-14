import type {
  RunDTO,
  CreateRunInput,
  UpdateRunInput,
  RemediationAttemptDTO,
  StageCostAggregateDTO,
} from "../../dto/index.js";

export interface IRunRepository {
  findById(runId: string): Promise<RunDTO | null>;
  findByPipeline(pipelineId: string, limit?: number): Promise<RunDTO[]>;
  findRecent(options?: { limit?: number; since?: string }): Promise<RunDTO[]>;
  countAll(): Promise<number>;
  findPaginated(options: { skip?: number; limit?: number }): Promise<RunDTO[]>;
  findDistinctPipelines(): Promise<string[]>;
  findStaleRuns(staleBefore: Date, limit?: number): Promise<RunDTO[]>;
  topStageCosts(pipelineId: string, limit: number, since: Date): Promise<StageCostAggregateDTO[]>;
  findAssignedRuns(): Promise<RunDTO[]>;
  create(input: CreateRunInput): Promise<RunDTO>;
  update(runId: string, updates: UpdateRunInput): Promise<RunDTO | null>;
  /**
   * Atomic business operation: claims the oldest QUEUED run for a runner.
   */
  claimNextQueuedRun(runnerId: string, assignedAt: string): Promise<RunDTO | null>;
  addRemediationHistory(runId: string, attempt: RemediationAttemptDTO): Promise<RunDTO | null>;
  delete(runId: string): Promise<boolean>;
  deleteAll(): Promise<void>;
}
