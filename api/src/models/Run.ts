import mongoose, { Schema } from "mongoose";

export type RunStageStatus = "pending" | "running" | "success" | "failed" | "skipped";
export type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";
export type RunEvent = "push" | "pull_request";

export interface RunStageMetrics {
  cpuSeconds: number | null;
  cpuPercentAvg: number | null;
  cpuPercentMax: number | null;
  memBytesMax: number | null;
  costUsdEstimated: number | null;
}

export interface RunStageResult {
  name: string;
  status: RunStageStatus;
  image: string;
  command: string;
  exitCode: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  logs: string;
  metrics: RunStageMetrics;
}

export interface RunSchemaType {
  pipelineId: string;
  commitSha: string;
  branch: string;
  triggeredBy: string;
  event: RunEvent;
  status: RunStatus;
  stages: RunStageResult[];
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  lastHeartbeatAt: Date | null;
  createdAt: Date;
}

const stageResultSchema = new Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "running", "success", "failed", "skipped"],
    },
    image: { type: String, required: true },
    command: { type: String, required: true },
    exitCode: { type: Number, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    logs: { type: String, default: "" },
    metrics: {
      cpuSeconds: { type: Number, default: null },
      cpuPercentAvg: { type: Number, default: null },
      cpuPercentMax: { type: Number, default: null },
      memBytesMax: { type: Number, default: null },
      costUsdEstimated: { type: Number, default: null },
    },
  },
  { _id: false },
);

const runSchema = new Schema<RunSchemaType>(
  {
    pipelineId: { type: String, required: true },
    commitSha: { type: String, required: true },
    branch: { type: String, required: true },
    triggeredBy: { type: String, required: true },
    event: { type: String, required: true, enum: ["push", "pull_request"] },
    status: {
      type: String,
      required: true,
      enum: ["queued", "running", "success", "failed", "cancelled"],
    },
    stages: { type: [stageResultSchema], default: [] },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    lastHeartbeatAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } },
);

export type RunDocument = mongoose.HydratedDocument<RunSchemaType>;

export const Run = mongoose.model<RunSchemaType>("Run", runSchema);
