export type StageStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface StageMetricsDTO {
  cpuSeconds: number | null;
  cpuPercentAvg: number | null;
  cpuPercentMax: number | null;
  memBytesMax: number | null;
  costUsdEstimated: number | null;
}

export interface StageDTO {
  name: string;
  status: StageStatus;
  image: string;
  command: string;
  exitCode: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  logs: string;
  metrics: StageMetricsDTO;
}

export interface UpdateStageStatusInput {
  status: StageStatus;
  exitCode?: number | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  durationMs?: number | null;
  metrics?: Partial<StageMetricsDTO>;
}
