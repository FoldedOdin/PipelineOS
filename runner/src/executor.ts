/**
 * Orchestrates stage execution order, Docker runs, log streaming, and run status updates.
 * Filled in when the runner service is fully wired to the API.
 */
import type { Logger } from "pino";
import { PassThrough } from "node:stream";
import { createDockerClient } from "./docker.js";
import { parsePipelineYaml } from "./yamlParser.js";
import { resolveStageOrder } from "./dependencyResolver.js";
import type { PipelineDefinition, PipelineStage } from "./types.js";

type ClaimedRun = { _id: string } & Record<string, unknown>;

interface DiagnosisPayload {
  summary: string;
  hints: string[];
  patterns: string[];
}

interface RemediationRule {
  id: string;
  enabled: boolean;
  name: string;
  match: {
    pipelineId: string | null;
    stageName: string | null;
    anyPatterns: string[];
    anyHintSubstrings: string[];
  };
  action: { type: "retry_stage"; maxAttempts: number; backoffSeconds: number };
  auto?: { enabled: boolean };
  stats?: { attempts: number; saves: number; failures: number; successRate: number };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is required`);
  }
  return value;
}

function looksLikePlaceholder(value: string): boolean {
  return value.startsWith("CHANGE_ME") || value === "same_as_above" || value === "random_string_here";
}

function optionalEnvNumber(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isHeaderTupleArray(value: unknown): value is [string, string][] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && typeof entry[1] === "string",
    )
  );
}

function isHeaderRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Headers) return false;
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === "string");
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiUrl = requiredEnv("API_URL").replace(/\/$/, "");
  const internalKey = requiredEnv("INTERNAL_API_KEY");
  if (looksLikePlaceholder(internalKey)) {
    throw new Error("INTERNAL_API_KEY is a placeholder; set a real value in deploy/.env");
  }

  const hdrs: unknown = init?.headers;
  const extraHeaders: Record<string, string> =
    hdrs instanceof Headers ? Object.fromEntries(hdrs.entries()) : isHeaderTupleArray(hdrs) ? Object.fromEntries(hdrs) : isHeaderRecord(hdrs) ? hdrs : {};

  return await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "x-internal-api-key": internalKey,
      ...extraHeaders,
    },
  });
}

async function claimNextRun(logger: Logger): Promise<ClaimedRun | null> {
  const res = await apiFetch("/internal/runs/claim", { method: "POST" });
  if (res.status === 204) return null;
  if (!res.ok) {
    logger.warn({ status: res.status, body: await res.text() }, "claim failed");
    return null;
  }
  const data: unknown = await res.json();
  const id = typeof data === "object" && data !== null ? (data as Record<string, unknown>)._id : undefined;
  if (typeof id !== "string" || id === "") return null;
  return { ...(data as Record<string, unknown>), _id: id };
}

async function fetchPipelineYaml(pipelineId: string, refSha: string, logger: Logger): Promise<string | null> {
  const res = await apiFetch(`/internal/pipelines/${encodeURIComponent(pipelineId)}?ref=${encodeURIComponent(refSha)}`, {
    method: "GET",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    logger.warn({ status: res.status, body: await res.text(), pipelineId }, "failed to fetch pipeline yaml");
    return null;
  }
  const data: unknown = await res.json();
  const rawYaml = typeof data === "object" && data !== null ? (data as Record<string, unknown>).rawYaml : undefined;
  return typeof rawYaml === "string" ? rawYaml : null;
}

async function fetchRemediationRules(pipelineId: string, logger: Logger): Promise<RemediationRule[]> {
  const res = await apiFetch(`/internal/remediation/rules?pipelineId=${encodeURIComponent(pipelineId)}`, { method: "GET" });
  if (!res.ok) {
    logger.warn({ status: res.status, body: await res.text(), pipelineId }, "failed to fetch remediation rules");
    return [];
  }
  const json: unknown = await res.json();
  if (typeof json !== "object" || json === null) return [];
  const rulesRaw = (json as Record<string, unknown>).rules;
  if (!Array.isArray(rulesRaw)) return [];
  const rules: RemediationRule[] = [];
  for (const r of rulesRaw) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : null;
    const enabled = o.enabled !== false;
    const name = typeof o.name === "string" ? o.name : "rule";
    const match = typeof o.match === "object" && o.match !== null ? (o.match as Record<string, unknown>) : {};
    const action = typeof o.action === "object" && o.action !== null ? (o.action as Record<string, unknown>) : null;
    if (!id || action === null) continue;
    if (action.type !== "retry_stage") continue;
    const maxAttempts = typeof action.maxAttempts === "number" ? action.maxAttempts : 2;
    const backoffSeconds = typeof action.backoffSeconds === "number" ? action.backoffSeconds : 0;
    rules.push({
      id,
      enabled,
      name,
      match: {
        pipelineId: typeof match.pipelineId === "string" ? match.pipelineId : null,
        stageName: typeof match.stageName === "string" ? match.stageName : null,
        anyPatterns: Array.isArray(match.anyPatterns) ? match.anyPatterns.filter((v): v is string => typeof v === "string") : [],
        anyHintSubstrings: Array.isArray(match.anyHintSubstrings)
          ? match.anyHintSubstrings.filter((v): v is string => typeof v === "string")
          : [],
      },
      action: { type: "retry_stage", maxAttempts, backoffSeconds },
    });
  }
  return rules;
}

async function fetchDiagnosis(runId: string, stageName: string): Promise<DiagnosisPayload | null> {
  const res = await apiFetch(`/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}/diagnosis`, { method: "GET" });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary : "";
  const hints = Array.isArray(o.hints) ? o.hints.filter((v): v is string => typeof v === "string") : [];
  const patterns = Array.isArray(o.patterns) ? o.patterns.filter((v): v is string => typeof v === "string") : [];
  return { summary, hints, patterns };
}

async function recordRuleOutcome(ruleId: string, outcome: "attempt" | "save" | "failure", logger: Logger): Promise<void> {
  const res = await apiFetch(`/internal/remediation/rules/${encodeURIComponent(ruleId)}/outcomes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ outcome }),
  });
  if (!res.ok) {
    logger.warn({ status: res.status, body: await res.text(), ruleId, outcome }, "failed to record rule outcome");
  }
}

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

async function upsertStage(runId: string, stageName: string, stage: { image: string; command: string }): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(stage),
  });
}

async function setStageStatus(runId: string, stageName: string, status: string, exitCode?: number): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, exitCode }),
  });
}

async function appendLogs(runId: string, stageName: string, logs: string): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}/logs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ logs }),
  });
}

async function postStageMetrics(
  runId: string,
  stageName: string,
  body: {
    cpuSeconds: number | null;
    cpuPercentAvg: number | null;
    cpuPercentMax: number | null;
    memBytesMax: number | null;
    costUsdEstimated: number | null;
  },
): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}/metrics`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setRunStatus(runId: string, status: string): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

async function heartbeatRun(runId: string): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

function ruleMatches(rule: RemediationRule, ctx: { pipelineId: string; stageName: string; diagnosis: DiagnosisPayload | null }): boolean {
  if (!rule.enabled) return false;
  if (rule.match.pipelineId && rule.match.pipelineId !== ctx.pipelineId) return false;
  if (rule.match.stageName && rule.match.stageName !== ctx.stageName) return false;

  if (rule.match.anyPatterns.length > 0) {
    const patterns = new Set(ctx.diagnosis?.patterns ?? []);
    const ok = rule.match.anyPatterns.some((p) => patterns.has(p));
    if (!ok) return false;
  }

  if (rule.match.anyHintSubstrings.length > 0) {
    const hints = (ctx.diagnosis?.hints ?? []).join("\n");
    const ok = rule.match.anyHintSubstrings.some((s) => hints.includes(s));
    if (!ok) return false;
  }

  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeCpuPercent(sample: unknown): number | null {
  if (typeof sample !== "object" || sample === null) return null;
  const s = sample as Record<string, unknown>;
  const cpuStats = typeof s.cpu_stats === "object" && s.cpu_stats !== null ? (s.cpu_stats as Record<string, unknown>) : null;
  const preCpuStats =
    typeof s.precpu_stats === "object" && s.precpu_stats !== null ? (s.precpu_stats as Record<string, unknown>) : null;
  if (cpuStats === null || preCpuStats === null) return null;

  const cpuUsage =
    typeof cpuStats.cpu_usage === "object" && cpuStats.cpu_usage !== null ? (cpuStats.cpu_usage as Record<string, unknown>) : null;
  const preCpuUsage =
    typeof preCpuStats.cpu_usage === "object" && preCpuStats.cpu_usage !== null
      ? (preCpuStats.cpu_usage as Record<string, unknown>)
      : null;
  if (cpuUsage === null || preCpuUsage === null) return null;

  const cpuTotal = cpuUsage.total_usage;
  const prevCpu = preCpuUsage.total_usage;
  const systemTotal = cpuStats.system_cpu_usage;
  const prevSystem = preCpuStats.system_cpu_usage;
  const onlineCpusRaw = cpuStats.online_cpus;
  const onlineCpus = typeof onlineCpusRaw === "number" && Number.isFinite(onlineCpusRaw) && onlineCpusRaw > 0 ? onlineCpusRaw : 1;

  if (typeof cpuTotal !== "number" || typeof systemTotal !== "number") return null;
  if (typeof prevCpu !== "number" || typeof prevSystem !== "number") return null;
  const cpuDelta = cpuTotal - prevCpu;
  const systemDelta = systemTotal - prevSystem;
  if (cpuDelta <= 0 || systemDelta <= 0) return null;
  return (cpuDelta / systemDelta) * onlineCpus * 100;
}

async function getContainerStatsOnce(container: unknown): Promise<unknown> {
  // dockerode's Container#stats has overloaded callback/promise signatures; keep typing loose here.
  return await (container as { stats: (opts: { stream: false }) => Promise<unknown> }).stats({ stream: false });
}

async function runContainerWithStats(input: {
  docker: ReturnType<typeof createDockerClient>;
  image: string;
  cmd: string[];
  env: Record<string, string>;
  stdout: PassThrough;
  stderr: PassThrough;
  logger: Logger;
}): Promise<{
  statusCode: number;
  cpuSeconds: number | null;
  cpuPercentAvg: number | null;
  cpuPercentMax: number | null;
  memBytesMax: number | null;
  memBytesAvg: number | null;
}> {
  const container = await input.docker.createContainer({
    Image: input.image,
    Cmd: input.cmd,
    Tty: false,
    Env: Object.entries(input.env).map(([k, v]) => `${k}=${v}`),
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await container.attach({ stream: true, stdout: true, stderr: true });
  stream.pipe(input.stdout);
  stream.pipe(input.stderr);

  await container.start();

  let samples = 0;
  let memBytesMax = 0;
  let memBytesSum = 0;
  let cpuPctMax = 0;
  let cpuPctSum = 0;
  let firstCpuTotal: number | null = null;
  let lastCpuTotal: number | null = null;

  const pollEveryMs = 2000;
  const poll = async (): Promise<void> => {
    try {
      const raw = await getContainerStatsOnce(container);
      if (typeof raw !== "object" || raw === null) return;
      const s = raw as Record<string, unknown>;

      const memStats = typeof s.memory_stats === "object" && s.memory_stats !== null ? (s.memory_stats as Record<string, unknown>) : {};
      const usage = memStats.usage;
      if (typeof usage === "number" && Number.isFinite(usage) && usage > memBytesMax) {
        memBytesMax = usage;
      }
      if (typeof usage === "number" && Number.isFinite(usage) && usage >= 0) {
        memBytesSum += usage;
      }

      const cpuPct = computeCpuPercent(raw);
      if (typeof cpuPct === "number" && Number.isFinite(cpuPct) && cpuPct > cpuPctMax) {
        cpuPctMax = cpuPct;
      }
      if (typeof cpuPct === "number" && Number.isFinite(cpuPct) && cpuPct >= 0) {
        cpuPctSum += cpuPct;
      }

      const cpuStats = typeof s.cpu_stats === "object" && s.cpu_stats !== null ? (s.cpu_stats as Record<string, unknown>) : {};
      const cpuUsage = typeof cpuStats.cpu_usage === "object" && cpuStats.cpu_usage !== null ? (cpuStats.cpu_usage as Record<string, unknown>) : {};
      const totalUsage = cpuUsage.total_usage;
      if (typeof totalUsage === "number" && Number.isFinite(totalUsage)) {
        firstCpuTotal ??= totalUsage;
        lastCpuTotal = totalUsage;
      }

      samples += 1;
    } catch (err) {
      input.logger.debug({ err }, "stats poll failed");
    }
  };

  const pollTimer = setInterval(() => {
    void poll();
  }, pollEveryMs);

  // Take an initial poll quickly so we capture early memory spikes.
  await poll();
  const waitResult: unknown = await container.wait();
  clearInterval(pollTimer);
  await poll();

  const statusCodeRaw =
    typeof waitResult === "object" && waitResult !== null ? (waitResult as Record<string, unknown>).StatusCode : undefined;
  const code = typeof statusCodeRaw === "number" && Number.isFinite(statusCodeRaw) ? statusCodeRaw : 1;

  // Best-effort cleanup.
  try {
    await container.remove({ force: true });
  } catch (err) {
    input.logger.debug({ err }, "container cleanup failed");
  }

  const cpuSeconds =
    typeof firstCpuTotal === "number" && typeof lastCpuTotal === "number" && lastCpuTotal >= firstCpuTotal
      ? (lastCpuTotal - firstCpuTotal) / 1e9
      : null;
  const cpuPercentAvg = samples > 0 ? cpuPctSum / samples : null;
  const cpuPercentMax = samples > 0 ? cpuPctMax : null;
  const memAvg = samples > 0 ? memBytesSum / samples : null;

  return {
    statusCode: code,
    cpuSeconds,
    cpuPercentAvg,
    cpuPercentMax,
    memBytesMax: samples > 0 ? memBytesMax : null,
    memBytesAvg: memAvg,
  };
}

async function ensureImage(docker: ReturnType<typeof createDockerClient>, image: string, logger: Logger): Promise<void> {
  try {
    await docker.getImage(image).inspect();
    return;
  } catch {
    // fall through to pull
  }

  const unknownToMessage = (value: unknown): string => {
    if (value instanceof Error) return value.message;
    try {
      return JSON.stringify(value);
    } catch {
      return "unknown error";
    }
  };

  await new Promise<void>((resolve, reject) => {
    void docker.pull(image, (err: unknown, stream?: NodeJS.ReadableStream) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(unknownToMessage(err)));
        return;
      }
      if (stream === undefined) {
        reject(new Error("docker pull returned no stream"));
        return;
      }
      docker.modem.followProgress(
        stream,
        (pullErr: unknown) => {
          if (pullErr) reject(pullErr instanceof Error ? pullErr : new Error(unknownToMessage(pullErr)));
          else resolve();
        },
        (event: unknown) => {
          if (typeof event === "object" && event !== null && "status" in event) {
            const status = (event as Record<string, unknown>).status;
            if (typeof status === "string") logger.debug({ image, status }, "pull progress");
          }
        },
      );
    });
  });
}

async function runStage(logger: Logger, runId: string, stage: PipelineStage, rules: RemediationRule[], pipelineId: string | null): Promise<void> {
  const stageName = stage.name;
  const image = stage.image;
  const command = `sh -lc ${JSON.stringify(stage.run)}`;

  await upsertStage(runId, stageName, { image, command });

  const docker = createDockerClient();
  await ensureImage(docker, image, logger);

  const stdout = new PassThrough();
  const stderr = new PassThrough();

  stdout.on("data", (chunk: Buffer) => {
    void appendLogs(runId, stageName, chunk.toString("utf8"));
  });
  stderr.on("data", (chunk: Buffer) => {
    void appendLogs(runId, stageName, chunk.toString("utf8"));
  });

  const cmd = ["sh", "-lc", stage.run];

  const applicable = pipelineId
    ? rules.filter((r) => ruleMatches(r, { pipelineId, stageName, diagnosis: null }))
    : rules.filter((r) => r.enabled && (r.match.stageName === null || r.match.stageName === stageName));
  const retryRule = applicable.length > 0 ? applicable[0] : null;
  const maxAttempts = retryRule ? Math.min(5, Math.max(1, Math.floor(retryRule.action.maxAttempts))) : 1;
  const backoffSeconds = retryRule ? Math.min(120, Math.max(0, Math.floor(retryRule.action.backoffSeconds))) : 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await setStageStatus(runId, stageName, "running");
    if (attempt > 1) {
      await appendLogs(runId, stageName, `\n[pipelineos] remediation: retry attempt ${String(attempt)}/${String(maxAttempts)}\n`);
    }
    if (retryRule && attempt === 2) {
      // Count a "remediation attempt" only when we actually retry (attempt 2+).
      await recordRuleOutcome(retryRule.id, "attempt", logger);
    }

    const wallStart = Date.now();
    const result = await runContainerWithStats({
      docker,
      image,
      cmd,
      env: stage.env,
      stdout,
      stderr,
      logger,
    });
    const wallSeconds = Math.max(0, (Date.now() - wallStart) / 1000);

    const cpuPrice = optionalEnvNumber("COST_CPU_USD_PER_CPU_SECOND") ?? 0;
    const memPrice = optionalEnvNumber("COST_MEM_USD_PER_GB_SECOND") ?? 0;
    const memGbSeconds = result.memBytesAvg !== null ? (result.memBytesAvg / 1e9) * wallSeconds : null;
    const costUsdEstimated =
      result.cpuSeconds !== null && memGbSeconds !== null ? result.cpuSeconds * cpuPrice + memGbSeconds * memPrice : null;

    void postStageMetrics(runId, stageName, {
      cpuSeconds: result.cpuSeconds,
      cpuPercentAvg: result.cpuPercentAvg,
      cpuPercentMax: result.cpuPercentMax,
      memBytesMax: result.memBytesMax,
      costUsdEstimated,
    }).catch(() => undefined);

    const statusCode = result.statusCode;
    if (statusCode === 0) {
      await setStageStatus(runId, stageName, "success", 0);
      if (retryRule && attempt > 1) {
        await recordRuleOutcome(retryRule.id, "save", logger);
      }
      return;
    }

    await setStageStatus(runId, stageName, "failed", statusCode);

    const diagnosis = await fetchDiagnosis(runId, stageName);
    if (pipelineId && retryRule && !ruleMatches(retryRule, { pipelineId, stageName, diagnosis })) {
      throw new Error(`stage ${stageName} failed with exit code ${String(statusCode)}`);
    }

    if (attempt < maxAttempts) {
      if (diagnosis?.summary) {
        await appendLogs(runId, stageName, `[pipelineos] diagnosis: ${diagnosis.summary}\n`);
      }
      if (backoffSeconds > 0) {
        await appendLogs(runId, stageName, `[pipelineos] backoff: waiting ${String(backoffSeconds)}s before retry\n`);
        await sleep(backoffSeconds * 1000);
      }
      continue;
    }

    if (retryRule && attempt > 1) {
      await recordRuleOutcome(retryRule.id, "failure", logger);
    }
    throw new Error(`stage ${stageName} failed with exit code ${String(statusCode)}`);
  }
}

async function runPipeline(
  logger: Logger,
  runId: string,
  pipeline: PipelineDefinition,
  rules: RemediationRule[],
  pipelineId: string | null,
): Promise<void> {
  const order = resolveStageOrder(pipeline.stages);
  const byName = new Map<string, PipelineStage>(pipeline.stages.map((s) => [s.name, s]));

  // Pre-create stage records so logs/status endpoints succeed even if runner crashes mid-flight.
  for (const stageName of order) {
    const stage = byName.get(stageName);
    if (!stage) continue;
    const command = `sh -lc ${JSON.stringify(stage.run)}`;
    await upsertStage(runId, stageName, { image: stage.image, command });
  }

  for (const stageName of order) {
    const stage = byName.get(stageName);
    if (!stage) continue;
    await runStage(logger, runId, stage, rules, pipelineId);
  }
}

export async function executeQueuedRun(logger: Logger): Promise<void> {
  const claimed = await claimNextRun(logger);
  if (claimed === null) return;

  const runId = claimed._id;
  const pipelineIdValue = (claimed as Record<string, unknown>).pipelineId;
  const pipelineId = typeof pipelineIdValue === "string" ? pipelineIdValue : null;
  const commitShaValue = (claimed as Record<string, unknown>).commitSha;
  const commitSha = typeof commitShaValue === "string" ? commitShaValue : null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  try {
    // Keep the run "fresh" while we work, so the API can detect stale runners.
    heartbeatInterval = setInterval(() => {
      void heartbeatRun(runId);
    }, 10_000);

    let pipeline: PipelineDefinition = demoPipeline();
    if (pipelineId && commitSha) {
      const yaml = await fetchPipelineYaml(pipelineId, commitSha, logger);
      if (yaml) {
        pipeline = parsePipelineYaml(yaml);
      } else {
        logger.warn({ pipelineId, commitSha }, "no pipeline yaml found; using demo pipeline");
      }
    }
    const rules = pipelineId ? await fetchRemediationRules(pipelineId, logger) : [];
    await runPipeline(logger, runId, pipeline, rules, pipelineId);
    await setRunStatus(runId, "success");
  } catch (err) {
    logger.error({ err, runId }, "run execution failed");
    await setRunStatus(runId, "failed");
  } finally {
    if (heartbeatInterval !== null) {
      clearInterval(heartbeatInterval);
    }
  }
}
