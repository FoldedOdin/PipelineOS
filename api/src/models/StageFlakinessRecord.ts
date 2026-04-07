import mongoose, { Schema } from "mongoose";

const outcomeSchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, required: true, ref: "Run" },
    success: { type: Boolean, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const stageFlakinessRecordSchema = new Schema(
  {
    pipelineId: { type: String, required: true, index: true },
    stageName: { type: String, required: true },
    outcomes: { type: [outcomeSchema], default: [] },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } },
);

stageFlakinessRecordSchema.index({ pipelineId: 1, stageName: 1 }, { unique: true });

export type StageFlakinessRecordDocument = mongoose.HydratedDocument<
  mongoose.InferSchemaType<typeof stageFlakinessRecordSchema>
>;

export const StageFlakinessRecord = mongoose.model("StageFlakinessRecord", stageFlakinessRecordSchema);
