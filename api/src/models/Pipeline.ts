import mongoose, { Schema } from "mongoose";

/**
 * Cached pipeline definition keyed by `{owner}/{repo}` (`pipelineId`).
 * Populated when YAML is fetched from GitHub in later milestones.
 */
const pipelineSchema = new Schema({
  pipelineId: { type: String, required: true, unique: true },
  refSha: { type: String, required: true },
  rawYaml: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export type PipelineDocument = mongoose.HydratedDocument<
  mongoose.InferSchemaType<typeof pipelineSchema>
>;
export const Pipeline = mongoose.model("Pipeline", pipelineSchema);
