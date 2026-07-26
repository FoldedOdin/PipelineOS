import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { MigrationRunner } from "./MigrationRunner.js";
import { SeedRunner } from "./SeedRunner.js";

describe("MigrationRunner and SeedRunner", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = new Database(":memory:");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipelineos-sqlite-test-"));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("applies up migrations in order and records versions", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "001_initial_schema.up.sql"),
      `
      CREATE TABLE IF NOT EXISTS test_table (
        id TEXT PRIMARY KEY,
        name TEXT
      );
    `,
    );
    fs.writeFileSync(
      path.join(tmpDir, "002_add_column.up.sql"),
      `
      ALTER TABLE test_table ADD COLUMN status TEXT;
    `,
    );

    const runner = new MigrationRunner(db, tmpDir);
    await runner.runMigrations();

    const applied = runner.getAppliedMigrations();
    expect(applied).toHaveLength(2);
    expect(applied[0].version).toBe("001_initial_schema");
    expect(applied[1].version).toBe("002_add_column");

    // Check table exists and has column
    const columns = db.prepare("PRAGMA table_info(test_table)").all() as { name: string }[];
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("name");
    expect(colNames).toContain("status");
  });

  it("skips already applied migrations", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "001_initial_schema.up.sql"),
      `
      CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY);
    `,
    );

    const runner = new MigrationRunner(db, tmpDir);
    await runner.runMigrations();
    expect(runner.getAppliedMigrations()).toHaveLength(1);

    // Running again shouldn't fail or re-insert
    await runner.runMigrations();
    expect(runner.getAppliedMigrations()).toHaveLength(1);
  });

  it("rolls back the latest migration when requested", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "001_initial_schema.up.sql"),
      `
      CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY);
    `,
    );
    fs.writeFileSync(
      path.join(tmpDir, "001_initial_schema.down.sql"),
      `
      DROP TABLE IF EXISTS test_table;
    `,
    );

    const runner = new MigrationRunner(db, tmpDir);
    await runner.runMigrations();
    expect(runner.getAppliedMigrations()).toHaveLength(1);

    await runner.rollbackMigration();
    expect(runner.getAppliedMigrations()).toHaveLength(0);

    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
      .get();
    expect(tableCheck).toBeUndefined();
  });

  it("SeedRunner seeds default remediation rules when table is empty", async () => {
    const migrationsDir = path.resolve(__dirname, "migrations");
    const migrationRunner = new MigrationRunner(db, migrationsDir);
    await migrationRunner.runMigrations();

    const seedRunner = new SeedRunner(db);
    await seedRunner.runSeeds();

    const rules = db.prepare("SELECT * FROM remediation_rules").all() as { name: string }[];
    expect(rules.length).toBe(1);
    expect(rules[0].name).toBe("Auto-Retry NPM/Yarn Network Timeouts");

    // Running seed again does not duplicate rules
    await seedRunner.runSeeds();
    const rulesAfter = db.prepare("SELECT * FROM remediation_rules").all();
    expect(rulesAfter.length).toBe(1);
  });
});
