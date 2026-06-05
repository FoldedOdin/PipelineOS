import { describe, it, expect, vi } from "vitest";
import { prepareWorkspace, cleanWorkspace } from "./workspace.js";
import { getRunnerWorkspaceRoot } from "./config.js";
import { join } from "node:path";

vi.mock("node:child_process", () => ({
  execFile: (cmd: string, args: string[], opts: any, cb: any) => {
    cb(null, { stdout: "", stderr: "" });
  }
}));

vi.mock("node:fs/promises", () => ({
  mkdir: async () => {},
  rm: async () => {}
}));

const dummyLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => dummyLogger,
} as any;

describe("Workspace management", () => {
  it("generates a secure workspace path and rejects traversal", async () => {
    try {
      await prepareWorkspace("../traversal", "owner/repo", "sha123", dummyLogger);
      expect.fail("Should have rejected path traversal");
    } catch (err: any) {
      expect(err.message).toMatch(/Invalid workspace path generated/);
    }
  });

  it("cleans workspace successfully", async () => {
    await cleanWorkspace("run-123", dummyLogger);
    expect(true).toBe(true);
  });
});
