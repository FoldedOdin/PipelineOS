/**
 * stage-runner.ts
 *
 * Executes a single pipeline stage: secret scrubbing, retry loop,
 * remediation rule matching, log streaming, metrics, artifact/cache upload.
 *
 * Publishes typed domain events to the eventBus at each lifecycle point so
 * that the API WebSocket layer (and future external bus) can subscribe without
 * polling.
 */
import type { Logger } from "pino";
import type { PipelineStage } from "./types.js";
import type { RemediationRule, DiagnosisPayload } from "./api-client.js";
import {
  upsertStage,
  setStageStatus,
  appendLogs,
  postStageMetrics,
  fetchDiagnosis,
  recordRuleOutcome,
  uploadArtifacts,
  uploadCache,
  downloadCache,
} from "./api-client.js";
import { runContainer, StageTimeoutError } from "./container-runner.js";
import { getDefaultTimeoutMs, getRunnerId } from "./config.js";
import { eventBus } from "./InProcessEventBus.js";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publishTimeline(runId: string, stageName: string, status: "Queued" | "Preparing" | "Pulling Image" | "Starting Container" | "Running" | "Succeeded" | "Failed" | "Timed Out" | "Cancelled") {
  eventBus.publish({
    id: randomUUID(),
    version: 1,
    type: "StageTimelineUpdated",
    occurredAt: new Date().toISOString(),
    source: `runner:${getRunnerId()}`,
    payload: {
      type: "StageTimelineUpdated",
      runId,
      stageName,
      status,
    },
  });
}

function buildScrubber(secrets: Record<string, string>): (text: string) => string {
  const secretValues = Object.values(secrets).filter((s) => s.length > 0);
  return (text: string) => {
    let out = text;
    for (const val of secretValues) {
      out = out.split(val).join("***");
    }
    return out;
  };
}

function optionalEnvNumber(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function ruleMatches(
  rule: RemediationRule,
  ctx: { pipelineId: string; stageName: string; diagnosis: DiagnosisPayload | null },
): boolean {
  if (!rule.enabled) return false;
  if (rule.match.pipelineId && rule.match.pipelineId !== ctx.pipelineId) return false;
  if (rule.match.stageName && rule.match.stageName !== ctx.stageName) return false;

  if (rule.match.anyPatterns.length > 0) {
    const patterns = new Set(ctx.diagnosis?.patterns ?? []);
    if (!rule.match.anyPatterns.some((p) => patterns.has(p))) return false;
  }

  if (rule.match.anyHintSubstrings.length > 0) {
    const hints = (ctx.diagnosis?.hints ?? []).join("\n");
    if (!rule.match.anyHintSubstrings.some((s) => hints.includes(s))) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export async function runStage(
  logger: Logger,
  runId: string,
  stage: PipelineStage,
  rules: RemediationRule[],
  pipelineId: string | null,
  workspacePath: string | null,
  secrets: Record<string, string>,
): Promise<void> {
  const stageName = stage.name;
  const image = stage.image;
  const cmd = ["sh", "-lc", stage.run];
  const command = `sh -lc ${JSON.stringify(stage.run)}`;
  const scrub = buildScrubber(secrets);

  publishTimeline(runId, stageName, "Queued");

  await upsertStage(runId, stageName, { image, command });

  const applicable = pipelineId
    ? rules.filter((r) => ruleMatches(r, { pipelineId, stageName, diagnosis: null }))
    : rules.filter(
        (r) => r.enabled && (r.match.stageName === null || r.match.stageName === stageName),
      );

  const retryRule = applicable[0] ?? null;
  const maxAttempts = retryRule
    ? Math.min(5, Math.max(1, Math.floor(retryRule.action.maxAttempts)))
    : 1;
  const backoffSeconds = retryRule
    ? Math.min(120, Math.max(0, Math.floor(retryRule.action.backoffSeconds)))
    : 0;

  // Resolve timeout: stage-level → env default → null (no timeout)
  const timeoutMs =
    stage.timeout_minutes != null ? stage.timeout_minutes * 60_000 : getDefaultTimeoutMs();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await setStageStatus(runId, stageName, "running");
    eventBus.publish({
      id: randomUUID(),
      version: 1,
      type: "StageStarted",
      occurredAt: new Date().toISOString(),
      source: `runner:${getRunnerId()}`,
      payload: { type: "StageStarted", runId, stageName, image, attempt },
    });

    if (attempt > 1) {
      await appendLogs(
        runId,
        stageName,
        `\n[pipelineos] remediation: retry attempt ${String(attempt)}/${String(maxAttempts)}\n`,
      );
    }
    if (retryRule && attempt === 2) {
      await recordRuleOutcome(retryRule.id, "attempt", logger);
    }

    if (attempt === 1 && workspacePath && stage.cache) {
      publishTimeline(runId, stageName, "Preparing");
      await downloadCache(stage.cache.key, workspacePath, logger);
    }

    const wallStart = Date.now();
    
    publishTimeline(runId, stageName, "Pulling Image"); // runContainer ensures image then starts

    let result: Awaited<ReturnType<typeof runContainer>>;
    try {
      result = await runContainer({
        image,
        cmd,
        env: { ...secrets, ...stage.env },
        onStdout: (chunk) => {
          publishTimeline(runId, stageName, "Running"); // 1st byte means running
          const text = scrub(chunk.toString("utf8"));
          void appendLogs(runId, stageName, text);
          eventBus.publish({
            id: randomUUID(),
            version: 1,
            type: "LogChunkReceived",
            occurredAt: new Date().toISOString(),
            source: `runner:${getRunnerId()}`,
            payload: { type: "LogChunkReceived", runId, stageName, chunk: text, source: "stdout" },
          });
        },
        onStderr: (chunk) => {
          publishTimeline(runId, stageName, "Running"); // 1st byte means running
          const text = scrub(chunk.toString("utf8"));
          void appendLogs(runId, stageName, text);
          eventBus.publish({
            id: randomUUID(),
            version: 1,
            type: "LogChunkReceived",
            occurredAt: new Date().toISOString(),
            source: `runner:${getRunnerId()}`,
            payload: { type: "LogChunkReceived", runId, stageName, chunk: text, source: "stderr" },
          });
        },
        logger,
        workspacePath,
        stageName,
        timeoutMs,
        runId,
      });
    } catch (err) {
      if (err instanceof StageTimeoutError) {
        publishTimeline(runId, stageName, "Timed Out");
        await setStageStatus(runId, stageName, "failed", 124);
        await appendLogs(runId, stageName, `\n[pipelineos] ${err.message}\n`);
        eventBus.publish({
          id: randomUUID(),
          version: 1,
          type: "StageTimedOut",
          occurredAt: new Date().toISOString(),
          source: `runner:${getRunnerId()}`,
          payload: { type: "StageTimedOut", runId, stageName, limitMs: timeoutMs ?? 0 },
        });
        throw err;
      }
      throw err;
    }

    const wallSeconds = Math.max(0, (Date.now() - wallStart) / 1000);
    const cpuPrice = optionalEnvNumber("COST_CPU_USD_PER_CPU_SECOND") ?? 0.000033;
    const memPrice = optionalEnvNumber("COST_MEM_USD_PER_GB_SECOND") ?? 0.000004;
    const cpuSecs =
      result.cpuSeconds ?? wallSeconds * Math.max(0.2, (result.cpuPercentAvg ?? 50) / 100);
    const memBytes = result.memBytesAvg ?? result.memBytesMax ?? 1024 * 1024 * 1024;
    const memGbSeconds = (memBytes / 1e9) * wallSeconds;
    const costUsdEstimated = cpuSecs * cpuPrice + memGbSeconds * memPrice;

    void postStageMetrics(runId, stageName, {
      cpuSeconds: result.cpuSeconds,
      cpuPercentAvg: result.cpuPercentAvg,
      cpuPercentMax: result.cpuPercentMax,
      memBytesMax: result.memBytesMax,
      costUsdEstimated,
    }).catch(() => undefined);

    if (result.statusCode === 0) {
      publishTimeline(runId, stageName, "Succeeded");
      await setStageStatus(runId, stageName, "success", 0);
      eventBus.publish({
        id: randomUUID(),
        version: 1,
        type: "StageFinished",
        occurredAt: new Date().toISOString(),
        source: `runner:${getRunnerId()}`,
        payload: {
          type: "StageFinished",
          runId,
          stageName,
          exitCode: 0,
          durationMs: Date.now() - wallStart,
        },
      });

      if (retryRule && attempt > 1) {
        await recordRuleOutcome(retryRule.id, "save", logger);
      }

      if (workspacePath) {
        if (stage.artifacts && stage.artifacts.length > 0) {
          await uploadArtifacts(runId, stageName, stage.artifacts, workspacePath, logger);
          for (const art of stage.artifacts) {
            eventBus.publish({
              id: randomUUID(),
              version: 1,
              type: "ArtifactUploaded",
              occurredAt: new Date().toISOString(),
              source: `runner:${getRunnerId()}`,
              payload: { type: "ArtifactUploaded", runId, stageName, fileName: art, sizeBytes: 0 },
            });
          }
        }
        if (stage.cache && stage.cache.paths.length > 0) {
          await uploadCache(stage.cache.key, stage.cache.paths, workspacePath, logger);
        }
      }
      return;
    }

    publishTimeline(runId, stageName, "Failed");
    await setStageStatus(runId, stageName, "failed", result.statusCode);
    eventBus.publish({
      id: randomUUID(),
      version: 1,
      type: "StageFailed",
      occurredAt: new Date().toISOString(),
      source: `runner:${getRunnerId()}`,
      payload: {
        type: "StageFailed",
        runId,
        stageName,
        exitCode: result.statusCode,
        attempt,
        maxAttempts,
      },
    });

    const diagnosis = await fetchDiagnosis(runId, stageName);
    if (pipelineId && retryRule && !ruleMatches(retryRule, { pipelineId, stageName, diagnosis })) {
      throw new Error(`stage ${stageName} failed with exit code ${String(result.statusCode)}`);
    }

    if (attempt < maxAttempts) {
      if (diagnosis?.summary) {
        await appendLogs(runId, stageName, `[pipelineos] diagnosis: ${diagnosis.summary}\n`);
      }
      if (backoffSeconds > 0) {
        await appendLogs(
          runId,
          stageName,
          `[pipelineos] backoff: waiting ${String(backoffSeconds)}s before retry\n`,
        );
        await sleep(backoffSeconds * 1000);
      }
      continue;
    }

    if (retryRule && attempt > 1) {
      await recordRuleOutcome(retryRule.id, "failure", logger);
    }
    throw new Error(`stage ${stageName} failed with exit code ${String(result.statusCode)}`);
  }
}
