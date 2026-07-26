export type StorageCategory =
  | "database"
  | "logs"
  | "artifacts"
  | "cache"
  | "workspaces"
  | "uploads";

export interface S3Config {
  region: string;
  bucket: string;
  prefix: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
}

export interface IConfigAdapter {
  getDatabaseProvider(): "sqlite" | "mongodb" | "postgresql";
  getDatabaseType(): "mongodb" | "sqlite" | "postgres";
  getStorageType(): "local" | "s3" | "minio";
  getSecretsType(): "memory" | "vault" | "file";
  getDataDirectory(): string;
  getStorageDirectory(): string;
  getLogsDirectory(): string;
  getStoragePath(category: StorageCategory): string;
  getSqlitePath(): string;
  getMongoUri(): string;
  getPort(): number;
  getNodeEnv(): string;
  getS3Config(): S3Config | null;
}
