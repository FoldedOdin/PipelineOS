import type { StageDTO } from "./stage.dto.js";

export type RunEvent = "push" | "pull_request";
export type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";

export interface RemediationAttemptDTO {
  ruleId?: string;
  ruleName?: string;
  stageName?: string;
  attemptedAt: Date;
  outcome?: "success" | "failed" | "pending";
}

export interface RunDTO {
  id: string; // Document _id or GUID string
  pipelineId: string;
  commitSha: string;
  branch: string;
  triggeredBy: string;
  event: RunEvent;
  status: RunStatus;
  stages: StageDTO[];
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  lastHeartbeatAt: Date | null;
  claimedBy: string | null;
  claimExpiresAt: Date | null;
  remediationHistory?: RemediationAttemptDTO[];
  createdAt: Date;
}

export interface CreateRunInput {
  pipelineId: string;
  commitSha: string;
  branch: string;
  triggeredBy: string;
  event: RunEvent;
  status?: RunStatus;
  stages?: StageDTO[];
}

export interface UpdateRunInput {
  status?: RunStatus;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  durationMs?: number | null;
  lastHeartbeatAt?: Date | null;
  claimedBy?: string | null;
  claimExpiresAt?: Date | null;
  stages?: StageDTO[];
  remediationHistory?: RemediationAttemptDTO[];
}

export interface RunSummary {
  id: string;
  pipelineId: string;
  commitSha: string;
  branch: string;
  status: RunStatus;
  createdAt: Date;
  durationMs: number | null;
}

export interface StageCostAggregateDTO {
  stageName: string;
  runs: number;
  totalCostUsd: number;
  avgCostUsd: number;
  maxCostUsd: number;
}
