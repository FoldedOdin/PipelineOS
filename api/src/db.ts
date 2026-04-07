import mongoose from "mongoose";
import type { Logger } from "pino";
import "./models/Pipeline.js";
import "./models/RemediationRule.js";
import "./models/Run.js";

/**
 * Establishes a single Mongoose connection using `MONGODB_URI`.
 * Fails fast if the URI is missing so misconfiguration is obvious at startup.
 */
export async function connectDb(logger: Logger): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (uri === undefined || uri === "") {
    throw new Error("MONGODB_URI is required");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  logger.info("connected to MongoDB");
}
