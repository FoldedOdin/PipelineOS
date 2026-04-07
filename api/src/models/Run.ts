import mongoose, { Schema } from "mongoose";

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
  },
  { _id: false },
);

const runSchema = new Schema(
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
    durationMs: { type: Schema.Types.Mixed, default: null },
    lastHeartbeatAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } },
);

export type RunDocument = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof runSchema>>;
export const Run = mongoose.model("Run", runSchema);
