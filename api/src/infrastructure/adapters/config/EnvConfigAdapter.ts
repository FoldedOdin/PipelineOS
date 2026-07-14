import path from "node:path";
import type { IConfigAdapter, StorageCategory } from "../../../domain/index.js";

export class EnvConfigAdapter implements IConfigAdapter {
  getDatabaseProvider(): "sqlite" | "mongodb" | "postgresql" {
    const provider = (process.env.DATABASE_PROVIDER ?? process.env.DATABASE_TYPE)?.toLowerCase();
    if (provider === "mongodb") return "mongodb";
    if (provider === "postgresql" || provider === "postgres") return "postgresql";
    return "sqlite";
  }

  getDatabaseType(): "mongodb" | "sqlite" | "postgres" {
    const provider = this.getDatabaseProvider();
    if (provider === "postgresql") return "postgres";
    return provider;
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

  getStoragePath(category: StorageCategory): string {
    return path.join(this.getDataDirectory(), category);
  }

  getSqlitePath(): string {
    return process.env.SQLITE_PATH ?? path.join(this.getStoragePath("database"), "pipelineos.db");
  }

  getStorageDirectory(): string {
    return process.env.STORAGE_DIR ?? this.getStoragePath("artifacts");
  }

  getLogsDirectory(): string {
    return process.env.LOGS_DIR ?? this.getStoragePath("logs");
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
