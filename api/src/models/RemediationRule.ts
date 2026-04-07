import mongoose, { Schema } from "mongoose";

export type RemediationActionType = "retry_stage";

const retryStageActionSchema = new Schema(
  {
    type: { type: String, required: true, enum: ["retry_stage"] },
    maxAttempts: { type: Number, required: true, min: 1, max: 5 },
    backoffSeconds: { type: Number, required: true, min: 0, max: 120 },
  },
  { _id: false },
);

const remediationMatchSchema = new Schema(
  {
    pipelineId: { type: String, default: null },
    stageName: { type: String, default: null },
    anyPatterns: { type: [String], default: [] },
    anyHintSubstrings: { type: [String], default: [] },
  },
  { _id: false },
);

const remediationRuleSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    name: { type: String, required: true },
    match: { type: remediationMatchSchema, required: true },
    action: { type: retryStageActionSchema, required: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } },
);

remediationRuleSchema.index({ "match.pipelineId": 1, enabled: 1 });

export type RemediationRuleDocument = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof remediationRuleSchema>>;
export const RemediationRule = mongoose.model("RemediationRule", remediationRuleSchema);

