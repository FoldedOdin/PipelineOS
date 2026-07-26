import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppliedMigration {
  version: string;
  appliedAt: string;
}

export class MigrationRunner {
  private readonly db: Database;
  private readonly migrationsDir: string;

  constructor(db: Database, migrationsDir?: string) {
    this.db = db;
    this.migrationsDir = migrationsDir ?? path.join(__dirname, "migrations");
  }

  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
  }

  getAppliedMigrations(): AppliedMigration[] {
    this.ensureMigrationsTable();
    const rows = this.db
      .prepare(
        "SELECT version, applied_at as appliedAt FROM schema_migrations ORDER BY version ASC",
      )
      .all() as { version: string; appliedAt: string }[];
    return rows;
  }

  async runMigrations(logger?: unknown): Promise<void> {
    this.ensureMigrationsTable();

    if (!fs.existsSync(this.migrationsDir)) {
      return;
    }

    const appliedSet = new Set(this.getAppliedMigrations().map((m) => m.version));
    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith(".up.sql"))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.up\.sql$/, "");
      if (appliedSet.has(version)) {
        continue;
      }

      const filePath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");

      const runMigrationTx = this.db.transaction(() => {
        this.db.exec(sql);
        this.db
          .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      });

      runMigrationTx();

      if (
        logger &&
        typeof logger === "object" &&
        "info" in logger &&
        typeof (logger as { info: unknown }).info === "function"
      ) {
        (logger as { info: (msg: string) => void }).info(`applied migration: ${version}`);
      }
    }
  }

  async rollbackMigration(targetVersion?: string, logger?: unknown): Promise<void> {
    this.ensureMigrationsTable();

    const applied = this.getAppliedMigrations();
    if (applied.length === 0) {
      return;
    }

    const versionToRollback = targetVersion ?? applied[applied.length - 1].version;
    const downFile = `${versionToRollback}.down.sql`;
    const filePath = path.join(this.migrationsDir, downFile);

    if (!fs.existsSync(filePath)) {
      throw new Error(`rollback migration file not found: ${filePath}`);
    }

    const sql = fs.readFileSync(filePath, "utf8");

    const rollbackTx = this.db.transaction(() => {
      this.db.exec(sql);
      this.db.prepare("DELETE FROM schema_migrations WHERE version = ?").run(versionToRollback);
    });

    rollbackTx();

    if (
      logger &&
      typeof logger === "object" &&
      "info" in logger &&
      typeof (logger as { info: unknown }).info === "function"
    ) {
      (logger as { info: (msg: string) => void }).info(
        `rolled back migration: ${versionToRollback}`,
      );
    }
  }
}
