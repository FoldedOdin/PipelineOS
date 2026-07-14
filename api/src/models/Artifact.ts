import mongoose, { Schema, Document } from "mongoose";

export interface IArtifactDocument extends Document {
  runId: string;
  stageName: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  storagePath: string;
  createdAt: Date;
}

const artifactSchema = new Schema(
  {
    runId: { type: String, required: true, index: true },
    stageName: { type: String, required: true },
    name: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    contentType: { type: String, required: true },
    storagePath: { type: String, required: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

artifactSchema.index({ runId: 1, name: 1 });

export const Artifact = mongoose.model<IArtifactDocument>("Artifact", artifactSchema);
