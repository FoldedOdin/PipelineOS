import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqlitePersistenceAdapter } from "./SqlitePersistenceAdapter.js";
import { SqliteBackupAdapter } from "./SqliteBackupAdapter.js";

describe("SqliteBackupAdapter", () => {
  let tmpDir: string;
  let dbPath: string;
  let backupDir: string;
  let adapter: SqlitePersistenceAdapter;
  let backupAdapter: SqliteBackupAdapter;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipelineos-backup-test-"));
    dbPath = path.join(tmpDir, "test.db");
    backupDir = path.join(tmpDir, "backups");
    adapter = new SqlitePersistenceAdapter(dbPath);
    await adapter.connect();
    await adapter.migrate();
    backupAdapter = new SqliteBackupAdapter(adapter, backupDir);
  });

  afterEach(async () => {
    await adapter.disconnect();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates online backup and lists available backups", async () => {
    await adapter.pipelineRepository.create({
      pipelineId: "pipe-backup",
      refSha: "sha-123",
      rawYaml: "name: test",
    });

    const meta = await backupAdapter.createBackup({ filename: "snapshot1.db" });
    expect(meta.id).toBe("snapshot1.db");
    expect(fs.existsSync(meta.path)).toBe(true);
    expect(meta.sizeBytes).toBeGreaterThan(0);

    const backups = await backupAdapter.listBackups();
    expect(backups.length).toBe(1);
    expect(backups[0].id).toBe("snapshot1.db");
  });

  it("restores database from backup snapshot safely", async () => {
    await adapter.pipelineRepository.create({
      pipelineId: "pipe-original",
      refSha: "original-sha",
      rawYaml: "name: original",
    });

    const backupMeta = await backupAdapter.createBackup({ filename: "backup-restore.db" });

    // modify current db
    await adapter.pipelineRepository.create({
      pipelineId: "pipe-modified",
      refSha: "modified-sha",
      rawYaml: "name: modified",
    });

    const currentAfterMod = await adapter.pipelineRepository.findById("pipe-modified");
    expect(currentAfterMod).not.toBeNull();

    // restore backup
    await backupAdapter.restoreBackup(backupMeta.path);

    // check state restored to original
    const restoredOriginal = await adapter.pipelineRepository.findById("pipe-original");
    expect(restoredOriginal).not.toBeNull();
    const restoredModified = await adapter.pipelineRepository.findById("pipe-modified");

    expect(restoredModified).toBeNull();
  });

  it("performs WAL checkpoints", async () => {
    const res = await backupAdapter.checkpoint({ mode: "PASSIVE" });
    expect(res.checkpointed).toBe(true);
    expect(res.details).toBeDefined();
  });
});
