import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalLogStorageAdapter } from "./LocalLogStorageAdapter.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("LocalLogStorageAdapter", () => {
  let tmpDir: string;
  let adapter: LocalLogStorageAdapter;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pipelineos-logs-"));
    adapter = new LocalLogStorageAdapter(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("appends logs to a file", async () => {
    await adapter.appendLog("pipe-1", "run-1", "build", "hello ");
    await adapter.appendLog("pipe-1", "run-1", "build", "world");

    const filePath = path.join(tmpDir, "pipe-1", "run-1", "build", "stage.log");
    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toBe("hello world");
  });

  it("returns a readable stream", async () => {
    await adapter.appendLog("pipe-1", "run-2", "test", "streaming data");

    const stream = await adapter.getLogsStream("pipe-1", "run-2", "test");
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as string);
    }
    expect(chunks.join("")).toBe("streaming data");
  });
});
