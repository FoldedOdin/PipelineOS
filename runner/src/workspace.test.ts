import { describe, it, expect, vi } from "vitest";
import { prepareWorkspace, cleanWorkspace } from "./workspace.js";
import type { Logger } from "pino";

vi.mock("node:child_process", () => ({
  execFile: (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, res: { stdout: string; stderr: string }) => void) => {
    cb(null, { stdout: "", stderr: "" });
  }
}));

vi.mock("node:fs/promises", () => ({
  mkdir: async () => Promise.resolve(),
  rm: async () => Promise.resolve()
}));

const dummyLogger = {
  info: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  debug: () => undefined,
  child: () => dummyLogger,
} as unknown as Logger;

describe("Workspace management", () => {
  it("generates a secure workspace path and rejects traversal", async () => {
    try {
      await prepareWorkspace("../traversal", "owner/repo", "sha123", dummyLogger);
      expect.fail("Should have rejected path traversal");
    } catch (err) {
      expect((err as Error).message).toMatch(/Invalid workspace path generated/);
    }
  });

  it("cleans workspace successfully", async () => {
    await cleanWorkspace("run-123", dummyLogger);
    expect(true).toBe(true);
  });
});
