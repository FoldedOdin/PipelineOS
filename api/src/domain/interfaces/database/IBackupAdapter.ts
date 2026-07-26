export interface BackupMetadata {
  readonly id: string;
  readonly path: string;
  readonly createdAt: Date;
  readonly sizeBytes: number;
  readonly provider: "sqlite" | "mongodb" | "postgresql";
}

export interface BackupOptions {
  readonly targetDirectory?: string;
  readonly filename?: string;
}

export interface WalCheckpointOptions {
  readonly mode?: "PASSIVE" | "FULL" | "RESTART" | "TRUNCATE";
}

export interface IBackupAdapter {
  /**
   * Creates a safe, consistent backup of the database online without blocking active readers or writers.
   */
  createBackup(options?: BackupOptions): Promise<BackupMetadata>;

  /**
   * Restores the database state from the specified backup file.
   */
  restoreBackup(backupPath: string): Promise<void>;

  /**
   * Lists available backup files in the backup directory.
   */
  listBackups(directory?: string): Promise<BackupMetadata[]>;

  /**
   * Performs a database checkpoint if supported (e.g., SQLite WAL checkpoint).
   */
  checkpoint(
    options?: WalCheckpointOptions,
  ): Promise<{ checkpointed: boolean; details?: Record<string, unknown> }>;
}
