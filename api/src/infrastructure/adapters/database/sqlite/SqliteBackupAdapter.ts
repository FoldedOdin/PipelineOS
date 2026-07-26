import fs from "node:fs";
import path from "node:path";
import DatabaseConstructor from "better-sqlite3";
import type {
  IBackupAdapter,
  BackupMetadata,
  BackupOptions,
  WalCheckpointOptions,
} from "../../../../domain/index.js";
import type { SqlitePersistenceAdapter } from "./SqlitePersistenceAdapter.js";

export class SqliteBackupAdapter implements IBackupAdapter {
  constructor(
    private readonly persistenceAdapter: SqlitePersistenceAdapter,
    private readonly defaultBackupDirectory: string = path.join(process.cwd(), "data", "backups"),
  ) {}

  async createBackup(options?: BackupOptions): Promise<BackupMetadata> {
    const db = this.persistenceAdapter.getRawDatabase();
    if (!db?.open) {
      throw new Error("Cannot create backup: database is not connected.");
    }

    const targetDir = options?.targetDirectory ?? this.defaultBackupDirectory;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename =
      options?.filename ?? `pipelineos-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
    const targetPath = path.join(targetDir, filename);

    await db.backup(targetPath);

    const stat = fs.statSync(targetPath);
    return {
      id: filename,
      path: targetPath,
      createdAt: stat.birthtime || new Date(),
      sizeBytes: stat.size,
      provider: "sqlite",
    };
  }

  async restoreBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found at ${backupPath}`);
    }

    const db = this.persistenceAdapter.getRawDatabase();
    if (!db) {
      throw new Error("Cannot restore backup: persistence adapter not initialized.");
    }

    const currentDbPath = db.name;
    if (currentDbPath === ":memory:") {
      const src = new DatabaseConstructor(backupPath, { readonly: true });
      try {
        await src.backup(currentDbPath);
      } finally {
        src.close();
      }
    } else {
      await this.persistenceAdapter.disconnect();
      fs.copyFileSync(backupPath, currentDbPath);
      await this.persistenceAdapter.connect();
    }
  }

  async listBackups(directory?: string): Promise<BackupMetadata[]> {
    const targetDir = directory ?? this.defaultBackupDirectory;
    if (!fs.existsSync(targetDir)) {
      return [];
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const backups: BackupMetadata[] = [];

    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith(".db") || entry.name.endsWith(".backup"))) {
        const fullPath = path.join(targetDir, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          backups.push({
            id: entry.name,
            path: fullPath,
            createdAt: stat.birthtime || stat.mtime || new Date(),
            sizeBytes: stat.size,
            provider: "sqlite",
          });
        } catch {
          // ignore inaccessible files
        }
      }
    }

    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return backups;
  }

  async checkpoint(
    options?: WalCheckpointOptions,
  ): Promise<{ checkpointed: boolean; details?: Record<string, unknown> }> {
    const db = this.persistenceAdapter.getRawDatabase();
    if (!db?.open) {
      throw new Error("Cannot run WAL checkpoint: database is not connected.");
    }

    const mode = options?.mode ?? "PASSIVE";
    const row = db.prepare(`PRAGMA wal_checkpoint(${mode})`).get() as Record<string, unknown>;

    return {
      checkpointed: true,
      details: row,
    };
  }
}
