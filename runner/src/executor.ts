/**
 * executor.ts
 *
 * Thin pipeline orchestrator. Responsible for:
 *  - Claiming the next queued run
 *  - Preparing the workspace (git clone)
 *  - Fetching pipeline YAML, remediation rules, and secrets
 *  - Running all stages in dependency order via stage-runner
 *  - Finalising the run status
 *  - Workspace cleanup
 *
 * All Docker and HTTP details live in container-runner.ts and api-client.ts.
 */
import fs from "node:fs";
import path from "node:path";
import type { Logger } from "pino";
import {
  claimNextRun,
  heartbeatRun,
  setRunStatus,
  fetchPipelineYaml,
  fetchRemediationRules,
  fetchSecrets,
  pingRunnerHeartbeat,
} from "./api-client.js";
import { killAllActiveContainers } from "./container-runner.js";
import { runStage } from "./stage-runner.js";
import { parsePipelineYaml } from "./yamlParser.js";
import { resolveStageOrder } from "./dependencyResolver.js";
import { prepareWorkspace, cleanWorkspace } from "./workspace.js";
import { getRetainWorkspaceOnFailure } from "./config.js";
import { eventBus } from "./InProcessEventBus.js";
import { randomUUID } from "node:crypto";
import type { PipelineDefinition, PipelineStage } from "./types.js";

// ---------------------------------------------------------------------------
// Demo pipeline — used when no YAML is found for a run
// ---------------------------------------------------------------------------

function demoPipeline(): PipelineDefinition {
  return {
    name: "Demo pipeline",
    on: ["push"],
    stages: [
      {
        name: "demo",
        image: "alpine:3.20",
        run: "echo 'hello from PipelineOS runner'; echo 'stderr line' 1>&2; sleep 1",
        depends_on: [],
        env: {},
        timeout_minutes: null,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Pipeline orchestration
// ---------------------------------------------------------------------------

async function runPipeline(
  logger: Logger,
  runId: string,
  pipeline: PipelineDefinition,
  rules: Awaited<ReturnType<typeof fetchRemediationRules>>,
  pipelineId: string | null,
  workspacePath: string | null,
  secrets: Record<string, string>,
): Promise<void> {
  const order = resolveStageOrder(pipeline.stages);
  const byName = new Map<string, PipelineStage>(pipeline.stages.map((s) => [s.name, s]));

  for (const stageName of order) {
    const stage = byName.get(stageName);
    if (!stage) continue;
    await runStage(logger, runId, stage, rules, pipelineId, workspacePath, secrets);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function executeQueuedRun(logger: Logger): Promise<void> {
  const claimed = await claimNextRun(logger);
  if (claimed === null) return;

  const runId = claimed._id;
  const runnerId = process.env.RUNNER_ID ?? "unknown";
  const { pipelineId, commitSha } = claimed;

  const runLogger = logger.child({ runId, runnerId });

  const runStart = Date.now();
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let workspacePath: string | null = null;
  let success = false;

  eventBus.publish({
    id: randomUUID(),
    version: 1,
    type: "RunClaimed",
    occurredAt: new Date().toISOString(),
    source: `runner:${runnerId}`,
    payload: { type: "RunClaimed", runId, runnerId, pipelineId },
  });

  try {
    heartbeatInterval = setInterval(() => {
      void heartbeatRun(runId);
    }, 10_000);

    let pipeline: PipelineDefinition = demoPipeline();
    if (pipelineId && commitSha) {
      workspacePath = await prepareWorkspace(runId, pipelineId, commitSha, runLogger);
      let yaml = await fetchPipelineYaml(pipelineId, commitSha, runLogger);
      if (!yaml) {
        try {
          yaml = await fs.promises.readFile(path.join(workspacePath, ".pipelineos.yml"), "utf8");
          runLogger.info({ pipelineId, commitSha }, "using local .pipelineos.yml from workspace");
        } catch (err) {
          runLogger.warn({ pipelineId, commitSha, err }, "no pipeline yaml found; using demo pipeline");
        }
      }
      if (yaml) {
        pipeline = parsePipelineYaml(yaml);
      }
    }

    const rules = pipelineId ? await fetchRemediationRules(pipelineId, runLogger) : [];
    const secrets = await fetchSecrets(runLogger);
    await runPipeline(runLogger, runId, pipeline, rules, pipelineId, workspacePath, secrets);
    await setRunStatus(runId, "success");
    success = true;
    eventBus.publish({
      id: randomUUID(),
      version: 1,
      type: "RunFinished",
      occurredAt: new Date().toISOString(),
      source: `runner:${runnerId}`,
      payload: { type: "RunFinished", runId, status: "success", durationMs: Date.now() - runStart },
    });
  } catch (err) {
    runLogger.error({ err, runId }, "run execution failed");
    await setRunStatus(runId, "failed");
    eventBus.publish({
      id: randomUUID(),
      version: 1,
      type: "RunFinished",
      occurredAt: new Date().toISOString(),
      source: `runner:${runnerId}`,
      payload: { type: "RunFinished", runId, status: "failed", durationMs: Date.now() - runStart },
    });
  } finally {
    if (heartbeatInterval !== null) clearInterval(heartbeatInterval);
    if (workspacePath) {
      if (!success && getRetainWorkspaceOnFailure()) {
        runLogger.info({ workspacePath }, "retaining workspace on failure due to config");
      } else {
        await cleanWorkspace(runId, runLogger);
      }
    }
  }
}

export { pingRunnerHeartbeat, killAllActiveContainers };
