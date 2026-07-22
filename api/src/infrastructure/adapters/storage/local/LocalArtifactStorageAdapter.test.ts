import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalArtifactStorageAdapter } from "./LocalArtifactStorageAdapter.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

describe("LocalArtifactStorageAdapter", () => {
  let tmpDir: string;
  let adapter: LocalArtifactStorageAdapter;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pipelineos-artifacts-"));
    adapter = new LocalArtifactStorageAdapter(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("uploads an artifact from a stream", async () => {
    const stream = Readable.from(["file ", "content ", "data"]);
    await adapter.uploadArtifact("pipe-1", "run-1", "build", "test.txt", stream);

    const filePath = path.join(tmpDir, "pipe-1", "run-1", "build", "test.txt");
    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toBe("file content data");
  });

  it("returns a readable stream for an artifact", async () => {
    const filePath = path.join(tmpDir, "pipe-1", "run-2", "test", "output.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '{"result": true}');

    const stream = await adapter.getArtifactStream("pipe-1", "run-2", "test", "output.json");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString("utf-8")).toBe('{"result": true}');
  });
});
