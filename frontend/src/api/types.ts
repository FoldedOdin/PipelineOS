export interface StageMetricsDTO {
  cpuSeconds?: number | null;
  cpuPercentAvg?: number | null;
  cpuPercentMax?: number | null;
  memBytesMax?: number | null;
  costUsdEstimated?: number | null;
}

export interface StageTimelineDTO {
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  exitCode?: number | null;
  metrics?: StageMetricsDTO;
}

export interface RunTimelineDTO {
  id: string;
  status: "queued" | "running" | "success" | "failed" | "cancelled";
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  stages: StageTimelineDTO[];
}

export interface RunnerHealthDTO {
  runnerId: string;
  status: "online" | "offline";
  lastHeartbeatAt: string;
  version?: string;
  hostname?: string;
  platform?: string;
  activeRuns?: number;
  maxConcurrentRuns?: number;
  isStale: boolean;
}
