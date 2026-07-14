import path from "node:path";
import type { IConfigAdapter } from "../../../domain/index.js";

export class EnvConfigAdapter implements IConfigAdapter {
  getDatabaseType(): "mongodb" | "sqlite" | "postgres" {
    const type = process.env.DATABASE_TYPE?.toLowerCase();
    if (type === "sqlite" || type === "postgres") return type;
    return "mongodb";
  }

  getStorageType(): "local" | "s3" | "minio" {
    const type = process.env.STORAGE_TYPE?.toLowerCase();
    if (type === "s3" || type === "minio") return type;
    return "local";
  }

  getSecretsType(): "memory" | "vault" | "file" {
    const type = process.env.SECRETS_TYPE?.toLowerCase();
    if (type === "vault" || type === "file") return type;
    return "memory";
  }

  getDataDirectory(): string {
    return process.env.DATA_DIR ?? "/var/lib/pipelineos/data";
  }

  getStorageDirectory(): string {
    return process.env.STORAGE_DIR ?? path.join(this.getDataDirectory(), "storage");
  }

  getLogsDirectory(): string {
    return process.env.LOGS_DIR ?? path.join(this.getDataDirectory(), "logs");
  }

  getMongoUri(): string {
    return process.env.MONGO_URI ?? "mongodb://localhost:27017/pipelineos";
  }

  getPort(): number {
    return Number(process.env.PORT ?? "3000");
  }

  getNodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  }
}
