import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm, mkdir } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import type { Logger } from "pino";
import { getRunnerWorkspaceRoot } from "./config.js";

const execFileAsync = promisify(execFile);

export async function prepareWorkspace(
  runId: string,
  repository: string,
  commitSha: string,
  logger: Logger
): Promise<string> {
  const root = getRunnerWorkspaceRoot();
  const workspacePath = resolve(join(root, runId));

  // Security: path traversal check
  if (!workspacePath.startsWith(resolve(root))) {
    throw new Error("Invalid workspace path generated");
  }

  logger.debug({ runId, workspacePath }, "Creating workspace directory");
  await mkdir(workspacePath, { recursive: true });

  const repoUrl = `https://github.com/${repository}.git`;

  try {
    logger.info({ runId, repoUrl }, "Cloning repository");
    // Secure fetch: shallow clone for a specific commit. 
    // We init an empty repo, fetch the specific sha, and checkout.
    // Setting GIT_TERMINAL_PROMPT=0 prevents interactive prompt hangs on private repos.
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

    await execFileAsync("git", ["init"], { cwd: workspacePath, env });
    await execFileAsync("git", ["remote", "add", "origin", repoUrl], { cwd: workspacePath, env });
    await execFileAsync("git", ["fetch", "--depth", "1", "origin", commitSha], { cwd: workspacePath, env });
    await execFileAsync("git", ["checkout", "FETCH_HEAD"], { cwd: workspacePath, env });
    
    logger.info({ runId, commitSha }, "Repository cloned successfully");
    return workspacePath;
  } catch (err) {
    logger.error({ err, runId, repository }, "Failed to clone repository");
    throw new Error("Repository clone failed");
  }
}

export async function cleanWorkspace(
  runId: string,
  logger: Logger
): Promise<void> {
  const root = getRunnerWorkspaceRoot();
  const workspacePath = resolve(join(root, runId));

  if (!workspacePath.startsWith(resolve(root))) {
    throw new Error("Invalid workspace path generated");
  }

  try {
    logger.debug({ runId, workspacePath }, "Cleaning workspace directory");
    await rm(workspacePath, { recursive: true, force: true });
    logger.info({ runId }, "Workspace cleaned successfully");
  } catch (err) {
    logger.error({ err, runId, workspacePath }, "Failed to clean workspace");
  }
}
