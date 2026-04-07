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

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiUrl = requiredEnv("API_URL").replace(/\/$/, "");
  const internalKey = requiredEnv("INTERNAL_API_KEY");
  if (looksLikePlaceholder(internalKey)) {
    throw new Error("INTERNAL_API_KEY is a placeholder; set a real value in deploy/.env");
  }
  return await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "x-internal-api-key": internalKey,
      ...(init?.headers ?? {}),
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

async function setRunStatus(runId: string, status: string): Promise<void> {
  await apiFetch(`/internal/runs/${runId}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
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

async function runStage(logger: Logger, runId: string, stage: PipelineStage): Promise<void> {
  const stageName = stage.name;
  const image = stage.image;
  const command = `sh -lc ${JSON.stringify(stage.run)}`;

  await upsertStage(runId, stageName, { image, command });
  await setStageStatus(runId, stageName, "running");

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
  const result: unknown = await docker.run(image, cmd, [stdout, stderr], {
    Tty: false,
    AttachStdout: true,
    AttachStderr: true,
    Env: Object.entries(stage.env).map(([k, v]) => `${k}=${v}`),
  });

  const maybeStatusCode =
    Array.isArray(result) && typeof result[0] === "object" && result[0] !== null
      ? (result[0] as Record<string, unknown>).StatusCode
      : undefined;
  const statusCode = typeof maybeStatusCode === "number" ? maybeStatusCode : 1;
  if (statusCode === 0) {
    await setStageStatus(runId, stageName, "success", 0);
  } else {
    await setStageStatus(runId, stageName, "failed", statusCode);
    throw new Error(`stage ${stageName} failed with exit code ${String(statusCode)}`);
  }
}

async function runPipeline(logger: Logger, runId: string, pipeline: PipelineDefinition): Promise<void> {
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
    await runStage(logger, runId, stage);
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
  try {
    let pipeline: PipelineDefinition = demoPipeline();
    if (pipelineId && commitSha) {
      const yaml = await fetchPipelineYaml(pipelineId, commitSha, logger);
      if (yaml) {
        pipeline = parsePipelineYaml(yaml);
      } else {
        logger.warn({ pipelineId, commitSha }, "no pipeline yaml found; using demo pipeline");
      }
    }
    await runPipeline(logger, runId, pipeline);
    await setRunStatus(runId, "success");
  } catch (err) {
    logger.error({ err, runId }, "run execution failed");
    await setRunStatus(runId, "failed");
  }
}
