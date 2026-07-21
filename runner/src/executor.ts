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

  let heartbeatInterval: NodeJS.Timeout | null = null;
  let workspacePath: string | null = null;
  let success = false;

  try {
    heartbeatInterval = setInterval(() => {
      void heartbeatRun(runId);
    }, 10_000);

    let pipeline: PipelineDefinition = demoPipeline();
    if (pipelineId && commitSha) {
      workspacePath = await prepareWorkspace(runId, pipelineId, commitSha, runLogger);
      const yaml = await fetchPipelineYaml(pipelineId, commitSha, runLogger);
      if (yaml) {
        pipeline = parsePipelineYaml(yaml);
      } else {
        runLogger.warn({ pipelineId, commitSha }, "no pipeline yaml found; using demo pipeline");
      }
    }

    const rules = pipelineId ? await fetchRemediationRules(pipelineId, runLogger) : [];
    const secrets = await fetchSecrets(runLogger);
    await runPipeline(runLogger, runId, pipeline, rules, pipelineId, workspacePath, secrets);
    await setRunStatus(runId, "success");
    success = true;
  } catch (err) {
    runLogger.error({ err, runId }, "run execution failed");
    await setRunStatus(runId, "failed");
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
