export interface IConfigAdapter {
  getDatabaseType(): "mongodb" | "sqlite" | "postgres";
  getStorageType(): "local" | "s3" | "minio";
  getSecretsType(): "memory" | "vault" | "file";
  getDataDirectory(): string;
  getStorageDirectory(): string;
  getLogsDirectory(): string;
  getMongoUri(): string;
  getPort(): number;
  getNodeEnv(): string;
}
