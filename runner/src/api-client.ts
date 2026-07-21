/**
 * api-client.ts
 *
 * All HTTP communication between the Runner and the Control Plane API.
 * Nothing in this module knows about Docker or pipeline execution details.
 */
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { Logger } from "pino";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export interface ClaimedRun {
  _id: string;
  pipelineId: string | null;
  commitSha: string | null;
  [key: string]: unknown;
}

export interface RemediationRule {
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
}

export interface DiagnosisPayload {
  summary: string;
  hints: string[];
  patterns: string[];
}

export interface StageMetrics {
  cpuSeconds: number | null;
  cpuPercentAvg: number | null;
  cpuPercentMax: number | null;
  memBytesMax: number | null;
  costUsdEstimated: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiUrl = requiredEnv("API_URL").replace(/\/$/, "");
  const internalKey = requiredEnv("INTERNAL_API_KEY");
  if (looksLikePlaceholder(internalKey)) {
    throw new Error("INTERNAL_API_KEY is a placeholder; set a real value in deploy/.env");
  }
  const runnerId = requiredEnv("RUNNER_ID");
  if (looksLikePlaceholder(runnerId)) {
    throw new Error("RUNNER_ID is a placeholder; set a real value in deploy/.env");
  }

  const hdrs: unknown = init?.headers;
  const extraHeaders: Record<string, string> =
    hdrs instanceof Headers
      ? Object.fromEntries(hdrs.entries())
      : isHeaderTupleArray(hdrs)
        ? Object.fromEntries(hdrs)
        : isHeaderRecord(hdrs)
          ? hdrs
          : {};

  return await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "x-internal-api-key": internalKey,
      "x-runner-id": runnerId,
      ...extraHeaders,
    },
  });
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

export async function claimNextRun(logger: Logger): Promise<ClaimedRun | null> {
  const res = await apiFetch("/internal/runs/claim", { method: "POST" });
  if (res.status === 204) return null;
  if (!res.ok) {
    logger.warn({ status: res.status, body: await res.text() }, "claim failed");
    return null;
  }
  const data: unknown = await res.json();
  const raw = data as Record<string, unknown>;
  const id = typeof raw._id === "string" ? raw._id : undefined;
  if (!id) return null;

  const pipelineId = typeof raw.pipelineId === "string" ? raw.pipelineId : null;
  const commitSha = typeof raw.commitSha === "string" ? raw.commitSha : null;
  return { ...raw, _id: id, pipelineId, commitSha };
}

export async function heartbeatRun(runId: string): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function setRunStatus(runId: string, status: string): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

// ---------------------------------------------------------------------------
// Stage lifecycle
// ---------------------------------------------------------------------------

export async function upsertStage(
  runId: string,
  stageName: string,
  stage: { image: string; command: string },
): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(stage),
  });
}

export async function setStageStatus(
  runId: string,
  stageName: string,
  status: string,
  exitCode?: number,
): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, exitCode }),
  });
}

export async function appendLogs(runId: string, stageName: string, logs: string): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}/logs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ logs }),
  });
}

export async function postStageMetrics(runId: string, stageName: string, metrics: StageMetrics): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}/metrics`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(metrics),
  });
}

// ---------------------------------------------------------------------------
// Pipeline data fetch
// ---------------------------------------------------------------------------

export async function fetchPipelineYaml(
  pipelineId: string,
  refSha: string,
  logger: Logger,
): Promise<string | null> {
  const res = await apiFetch(
    `/internal/pipelines/${encodeURIComponent(pipelineId)}?ref=${encodeURIComponent(refSha)}`,
    { method: "GET" },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    logger.warn({ status: res.status, body: await res.text(), pipelineId }, "failed to fetch pipeline yaml");
    return null;
  }
  const data: unknown = await res.json();
  const rawYaml =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>).rawYaml : undefined;
  return typeof rawYaml === "string" ? rawYaml : null;
}

export async function fetchRemediationRules(
  pipelineId: string,
  logger: Logger,
): Promise<RemediationRule[]> {
  const res = await apiFetch(`/internal/remediation/rules?pipelineId=${encodeURIComponent(pipelineId)}`, {
    method: "GET",
  });
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
    const match =
      typeof o.match === "object" && o.match !== null ? (o.match as Record<string, unknown>) : {};
    const action =
      typeof o.action === "object" && o.action !== null ? (o.action as Record<string, unknown>) : null;
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
        anyPatterns: Array.isArray(match.anyPatterns)
          ? match.anyPatterns.filter((v): v is string => typeof v === "string")
          : [],
        anyHintSubstrings: Array.isArray(match.anyHintSubstrings)
          ? match.anyHintSubstrings.filter((v): v is string => typeof v === "string")
          : [],
      },
      action: { type: "retry_stage", maxAttempts, backoffSeconds },
    });
  }
  return rules;
}

export async function fetchSecrets(logger: Logger): Promise<Record<string, string>> {
  const res = await apiFetch(`/internal/secrets`, { method: "GET" });
  if (!res.ok) {
    logger.warn({ status: res.status, body: await res.text() }, "failed to fetch secrets");
    return {};
  }
  const json: unknown = await res.json();
  if (typeof json !== "object" || json === null) return {};
  const secrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (typeof v === "string") secrets[k] = v;
  }
  return secrets;
}

export async function fetchDiagnosis(
  runId: string,
  stageName: string,
): Promise<DiagnosisPayload | null> {
  const res = await apiFetch(
    `/internal/runs/${runId}/stages/${encodeURIComponent(stageName)}/diagnosis`,
    { method: "GET" },
  );
  if (!res.ok) return null;
  const json: unknown = await res.json();
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary : "";
  const hints = Array.isArray(o.hints) ? o.hints.filter((v): v is string => typeof v === "string") : [];
  const patterns = Array.isArray(o.patterns)
    ? o.patterns.filter((v): v is string => typeof v === "string")
    : [];
  return { summary, hints, patterns };
}

export async function recordRuleOutcome(
  ruleId: string,
  outcome: "attempt" | "save" | "failure",
  logger: Logger,
): Promise<void> {
  const res = await apiFetch(
    `/internal/remediation/rules/${encodeURIComponent(ruleId)}/outcomes`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome }),
    },
  );
  if (!res.ok) {
    logger.warn({ status: res.status, body: await res.text(), ruleId, outcome }, "failed to record rule outcome");
  }
}

// ---------------------------------------------------------------------------
// Artifacts and cache
// ---------------------------------------------------------------------------

export async function uploadArtifacts(
  runId: string,
  stageName: string,
  artifacts: string[],
  workspacePath: string,
  logger: Logger,
): Promise<void> {
  if (artifacts.length === 0) return;
  try {
    const tarPath = path.join("/tmp", `${runId}_${stageName}_artifacts.tar.gz`);
    const paths = artifacts.map((p) => `"${p}"`).join(" ");
    execSync(`tar -czf ${tarPath} -C ${workspacePath} ${paths}`, { stdio: "ignore" });

    const buf = await fs.readFile(tarPath);
    const res = await apiFetch(`/internal/runs/${runId}/artifacts/${stageName}`, {
      method: "POST",
      headers: { "content-type": "application/gzip" },
      body: buf,
    });
    if (!res.ok) {
      logger.warn({ status: res.status, body: await res.text() }, "failed to upload artifacts");
    }
    await fs.unlink(tarPath).catch(() => undefined);
  } catch (err) {
    logger.warn({ err }, "failed to pack/upload artifacts");
  }
}

export async function uploadCache(
  key: string,
  paths: string[],
  workspacePath: string,
  logger: Logger,
): Promise<void> {
  if (paths.length === 0) return;
  try {
    const tarPath = path.join("/tmp", `cache_${key}.tar.gz`);
    const pStr = paths.map((p) => `"${p}"`).join(" ");
    execSync(`tar -czf ${tarPath} -C ${workspacePath} ${pStr}`, { stdio: "ignore" });

    const buf = await fs.readFile(tarPath);
    const res = await apiFetch(`/internal/cache/${key}`, {
      method: "POST",
      headers: { "content-type": "application/gzip" },
      body: buf,
    });
    if (!res.ok) {
      logger.warn({ status: res.status, body: await res.text() }, "failed to upload cache");
    }
    await fs.unlink(tarPath).catch(() => undefined);
  } catch (err) {
    logger.warn({ err }, "failed to pack/upload cache");
  }
}

export async function downloadCache(
  key: string,
  workspacePath: string,
  logger: Logger,
): Promise<void> {
  try {
    const res = await apiFetch(`/internal/cache/${key}`, { method: "GET" });
    if (res.status === 404) return;
    if (!res.ok) {
      logger.warn({ status: res.status, body: await res.text() }, "failed to download cache");
      return;
    }

    const buf = await res.arrayBuffer();
    const tarPath = path.join("/tmp", `dl_cache_${key}.tar.gz`);
    await fs.writeFile(tarPath, Buffer.from(buf));
    execSync(`tar -xzf ${tarPath} -C ${workspacePath}`, { stdio: "ignore" });
    await fs.unlink(tarPath).catch(() => undefined);
  } catch (err) {
    logger.warn({ err }, "failed to download/extract cache");
  }
}

// ---------------------------------------------------------------------------
// Runner registration
// ---------------------------------------------------------------------------

export async function pingRunnerHeartbeat(
  logger: Logger,
  activeRuns: number,
  maxConcurrentRuns: number,
): Promise<void> {
  try {
    const os = await import("node:os");
    const version = "0.1.0";
    const hostname = os.hostname();
    const platform = os.platform();
    await apiFetch("/internal/runners/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version, hostname, platform, activeRuns, maxConcurrentRuns }),
    });
  } catch (err) {
    logger.debug({ err }, "runner heartbeat ping failed");
  }
}
