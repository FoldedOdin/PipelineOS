import mongoose, { Schema, Document } from "mongoose";

export interface IRunnerRegistration extends Document {
  runnerId: string;
  lastHeartbeatAt: Date;
  status: "online" | "offline";
  version?: string;
  hostname?: string;
  platform?: string;
}

const RunnerRegistrationSchema = new Schema(
  {
    runnerId: { type: String, required: true, unique: true },
    lastHeartbeatAt: { type: Date, required: true },
    status: { type: String, required: true, enum: ["online", "offline"], default: "online" },
    version: { type: String },
    hostname: { type: String },
    platform: { type: String },
  },
  { timestamps: true }
);

export const RunnerRegistration = mongoose.model<IRunnerRegistration>("RunnerRegistration", RunnerRegistrationSchema);
