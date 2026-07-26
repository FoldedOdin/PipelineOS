import fs from "node:fs";
import path from "node:path";
import DatabaseConstructor, { type Database } from "better-sqlite3";
import type {
  IPersistenceAdapter,
  PersistenceCapabilities,
  DatabaseHealthInfo,
  IRunRepository,
  IStageRepository,
  IPipelineRepository,
  IRemediationRuleRepository,
  IRunnerRegistrationRepository,
  IStageFlakinessRepository,
  IWebhookDeliveryRepository,
  IArtifactRepository,
} from "../../../../domain/index.js";
import {
  SqliteRunRepository,
  SqliteStageRepository,
  SqlitePipelineRepository,
  SqliteRemediationRuleRepository,
  SqliteRunnerRegistrationRepository,
  SqliteStageFlakinessRepository,
  SqliteWebhookDeliveryRepository,
  SqliteArtifactRepository,
} from "./repositories/index.js";
import { MigrationRunner } from "./MigrationRunner.js";
import { SeedRunner } from "./SeedRunner.js";

export class SqlitePersistenceAdapter implements IPersistenceAdapter {
  readonly capabilities: PersistenceCapabilities = {
    supportsTransactions: true,
    supportsJson: true,
    supportsFullTextSearch: false,
    supportsConcurrentLocks: false,
  };

  private db: Database | null = null;
  private dbPath: string;
  private migrationRunner: MigrationRunner | null = null;
  private seedRunner: SeedRunner | null = null;

  private _runRepository: IRunRepository | null = null;
  private _stageRepository: IStageRepository | null = null;
  private _pipelineRepository: IPipelineRepository | null = null;
  private _remediationRuleRepository: IRemediationRuleRepository | null = null;
  private _runnerRegistrationRepository: IRunnerRegistrationRepository | null = null;
  private _stageFlakinessRepository: IStageFlakinessRepository | null = null;
  private _webhookDeliveryRepository: IWebhookDeliveryRepository | null = null;
  private _artifactRepository: IArtifactRepository | null = null;

  constructor(configOrPath?: string | { getSqlitePath(): string }, existingDb?: Database) {
    if (existingDb) {
      this.db = existingDb;
      this.dbPath = existingDb.name || ":memory:";
      this.initRepositories(this.db);
    } else if (typeof configOrPath === "string") {
      this.dbPath = configOrPath;
    } else if (configOrPath && typeof configOrPath.getSqlitePath === "function") {
      this.dbPath = configOrPath.getSqlitePath();
    } else {
      if (process.env.PIPELINEOS_SQLITE_PATH) {
        this.dbPath = process.env.PIPELINEOS_SQLITE_PATH;
      } else if (process.env.DATA_DIR) {
        this.dbPath = path.join(process.env.DATA_DIR, "pipelineos.db");
      } else {
        this.dbPath = path.join(process.cwd(), "data", "pipelineos.db");
      }
    }
  }

  private initRepositories(db: Database): void {
    this._runRepository = new SqliteRunRepository(db);
    this._stageRepository = new SqliteStageRepository(db);
    this._pipelineRepository = new SqlitePipelineRepository(db);
    this._remediationRuleRepository = new SqliteRemediationRuleRepository(db);
    this._runnerRegistrationRepository = new SqliteRunnerRegistrationRepository(db);
    this._stageFlakinessRepository = new SqliteStageFlakinessRepository(db);
    this._webhookDeliveryRepository = new SqliteWebhookDeliveryRepository(db);
    this._artifactRepository = new SqliteArtifactRepository(db);
    this.migrationRunner = new MigrationRunner(db);
    this.seedRunner = new SeedRunner(db);
  }

  get runRepository(): IRunRepository {
    if (!this._runRepository) throw new Error("Database not connected. Call connect() first.");
    return this._runRepository;
  }

  get stageRepository(): IStageRepository {
    if (!this._stageRepository) throw new Error("Database not connected. Call connect() first.");
    return this._stageRepository;
  }

  get pipelineRepository(): IPipelineRepository {
    if (!this._pipelineRepository) throw new Error("Database not connected. Call connect() first.");
    return this._pipelineRepository;
  }

  get remediationRuleRepository(): IRemediationRuleRepository {
    if (!this._remediationRuleRepository)
      throw new Error("Database not connected. Call connect() first.");
    return this._remediationRuleRepository;
  }

  get runnerRegistrationRepository(): IRunnerRegistrationRepository {
    if (!this._runnerRegistrationRepository)
      throw new Error("Database not connected. Call connect() first.");
    return this._runnerRegistrationRepository;
  }

  get stageFlakinessRepository(): IStageFlakinessRepository {
    if (!this._stageFlakinessRepository)
      throw new Error("Database not connected. Call connect() first.");
    return this._stageFlakinessRepository;
  }

  get webhookDeliveryRepository(): IWebhookDeliveryRepository {
    if (!this._webhookDeliveryRepository)
      throw new Error("Database not connected. Call connect() first.");
    return this._webhookDeliveryRepository;
  }

  get artifactRepository(): IArtifactRepository {
    if (!this._artifactRepository) throw new Error("Database not connected. Call connect() first.");
    return this._artifactRepository;
  }

  getRawDatabase(): Database | null {
    return this.db;
  }

  async connect(logger?: unknown): Promise<void> {
    if (this.db?.open) {
      return;
    }

    if (this.dbPath !== ":memory:") {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseConstructor(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");

    this.initRepositories(this.db);

    if (
      logger &&
      typeof logger === "object" &&
      "info" in logger &&
      typeof (logger as { info: unknown }).info === "function"
    ) {
      (logger as { info: (msg: string) => void }).info(`connected to SQLite at ${this.dbPath}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db?.open) {
      this.db.close();
      this.db = null;
    }
  }

  async migrate(): Promise<void> {
    if (!this.migrationRunner || !this.seedRunner) {
      throw new Error("Database not connected. Call connect() first.");
    }
    await this.migrationRunner.runMigrations();
    await this.seedRunner.runSeeds();
  }

  async healthCheck(): Promise<DatabaseHealthInfo> {
    try {
      if (!this.db?.open) {
        return {
          connected: false,
          provider: "sqlite",
          database: this.dbPath,
        };
      }

      const versionRow = this.db.prepare("SELECT sqlite_version() as version").get() as {
        version: string;
      };
      const journalModeRow = this.db.prepare("PRAGMA journal_mode").get() as {
        journal_mode: string;
      };

      let migrationVersion: number | undefined;
      try {
        const migrations = this.migrationRunner?.getAppliedMigrations() ?? [];
        if (migrations.length > 0) {
          const lastVer = migrations[migrations.length - 1].version;
          const num = parseInt(lastVer.split("_")[0], 10);
          if (!isNaN(num)) migrationVersion = num;
        }
      } catch {
        migrationVersion = undefined;
      }

      return {
        connected: true,
        provider: "sqlite",
        database: this.dbPath,
        version: versionRow?.version,
        migrationVersion,
        wal: journalModeRow?.journal_mode?.toLowerCase() === "wal",
        details: {
          journalMode: journalModeRow?.journal_mode,
        },
      };
    } catch (err) {
      return {
        connected: false,
        provider: "sqlite",
        database: this.dbPath,
        details: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}
