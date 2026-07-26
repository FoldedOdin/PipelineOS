/**
 * container-runner.ts
 *
 * Docker container lifecycle: image pull, creation, attach (demuxed),
 * resource stats polling, timeout enforcement, and cleanup.
 *
 * Fixes:
 *  - Uses `docker.modem.demuxStream` to properly separate stdout and stderr.
 *  - Enforces `timeoutMs` by racing `container.wait()` against a deadline
 *    that calls `container.stop()` before throwing `StageTimeoutError`.
 *  - Exposes the active container handle so the caller can kill it on SIGTERM.
 */
import { PassThrough } from "node:stream";
import type { Logger } from "pino";
import { createDockerClient } from "./docker.js";
import { getContainerMemoryLimitBytes, getContainerNanoCpus, getRunnerId } from "./config.js";
import { eventBus } from "./InProcessEventBus.js";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class StageTimeoutError extends Error {
  constructor(stageName: string, timeoutMs: number) {
    super(`Stage "${stageName}" timed out after ${timeoutMs / 1000}s`);
    this.name = "StageTimeoutError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContainerRunInput {
  image: string;
  cmd: string[];
  env: Record<string, string>;
  /** Raw log chunks are written here (already demuxed). */
  onStdout: (chunk: Buffer) => void;
  onStderr: (chunk: Buffer) => void;
  logger: Logger;
  workspacePath: string | null;
  /** Stage name — used only for error messages and timeout errors. */
  stageName: string;
  /** Milliseconds before the container is killed. `null` = no timeout. */
  timeoutMs: number | null;
  /** Run ID to tag events with */
  runId: string;
}

export interface ContainerResult {
  statusCode: number;
  cpuSeconds: number | null;
  cpuPercentAvg: number | null;
  cpuPercentMax: number | null;
  memBytesMax: number | null;
  memBytesAvg: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeCpuPercent(sample: unknown): number | null {
  if (typeof sample !== "object" || sample === null) return null;
  const s = sample as Record<string, unknown>;
  const cpuStats =
    typeof s.cpu_stats === "object" && s.cpu_stats !== null
      ? (s.cpu_stats as Record<string, unknown>)
      : null;
  const preCpuStats =
    typeof s.precpu_stats === "object" && s.precpu_stats !== null
      ? (s.precpu_stats as Record<string, unknown>)
      : null;
  if (!cpuStats || !preCpuStats) return null;

  const cpuUsage =
    typeof cpuStats.cpu_usage === "object" && cpuStats.cpu_usage !== null
      ? (cpuStats.cpu_usage as Record<string, unknown>)
      : null;
  const preCpuUsage =
    typeof preCpuStats.cpu_usage === "object" && preCpuStats.cpu_usage !== null
      ? (preCpuStats.cpu_usage as Record<string, unknown>)
      : null;
  if (!cpuUsage || !preCpuUsage) return null;

  const cpuTotal = cpuUsage.total_usage;
  const prevCpu = preCpuUsage.total_usage;
  const systemTotal = cpuStats.system_cpu_usage;
  const prevSystem = preCpuStats.system_cpu_usage;
  const onlineCpusRaw = cpuStats.online_cpus;
  const onlineCpus =
    typeof onlineCpusRaw === "number" && Number.isFinite(onlineCpusRaw) && onlineCpusRaw > 0
      ? onlineCpusRaw
      : 1;

  if (
    typeof cpuTotal !== "number" ||
    typeof systemTotal !== "number" ||
    typeof prevCpu !== "number" ||
    typeof prevSystem !== "number"
  )
    return null;

  const cpuDelta = cpuTotal - prevCpu;
  const systemDelta = systemTotal - prevSystem;
  if (cpuDelta <= 0 || systemDelta <= 0) return null;
  return (cpuDelta / systemDelta) * onlineCpus * 100;
}

function computeNetworkStats(sample: unknown): { rx: number; tx: number } {
  if (typeof sample !== "object" || sample === null) return { rx: 0, tx: 0 };
  const s = sample as Record<string, unknown>;
  const networks =
    typeof s.networks === "object" && s.networks !== null
      ? (s.networks as Record<string, Record<string, unknown>>)
      : null;
  if (!networks) return { rx: 0, tx: 0 };

  let rx = 0;
  let tx = 0;
  for (const net of Object.values(networks)) {
    if (typeof net.rx_bytes === "number") rx += net.rx_bytes;
    if (typeof net.tx_bytes === "number") tx += net.tx_bytes;
  }
  return { rx, tx };
}

function computeBlockIo(sample: unknown): { read: number; write: number } {
  if (typeof sample !== "object" || sample === null) return { read: 0, write: 0 };
  const s = sample as Record<string, unknown>;
  const blkio =
    typeof s.blkio_stats === "object" && s.blkio_stats !== null
      ? (s.blkio_stats as Record<string, unknown>)
      : null;
  if (!blkio) return { read: 0, write: 0 };

  const ioServiceBytes = Array.isArray(blkio.io_service_bytes_recursive)
    ? blkio.io_service_bytes_recursive
    : [];

  let read = 0;
  let write = 0;
  for (const item of ioServiceBytes) {
    if (typeof item !== "object" || item === null) continue;
    const stat = item as { op?: string; value?: number };
    if (stat.op && stat.op.toLowerCase() === "read" && typeof stat.value === "number") {
      read += stat.value;
    } else if (stat.op && stat.op.toLowerCase() === "write" && typeof stat.value === "number") {
      write += stat.value;
    }
  }
  return { read, write };
}

type DockerContainer = Awaited<
  ReturnType<ReturnType<typeof createDockerClient>["createContainer"]>
>;

// ---------------------------------------------------------------------------
// Image management
// ---------------------------------------------------------------------------

export async function ensureImage(
  docker: ReturnType<typeof createDockerClient>,
  image: string,
  logger: Logger,
): Promise<void> {
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

  logger.info({ image }, "pulling docker image");
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
          if (pullErr)
            reject(pullErr instanceof Error ? pullErr : new Error(unknownToMessage(pullErr)));
          else resolve();
        },
        (event: unknown) => {
          if (
            typeof event === "object" &&
            event !== null &&
            "status" in event &&
            typeof (event as Record<string, unknown>).status === "string"
          ) {
            logger.debug(
              { image, status: (event as Record<string, unknown>).status },
              "pull progress",
            );
          }
        },
      );
    });
  });
}

// ---------------------------------------------------------------------------
// Active container registry — lets SIGTERM handler kill in-flight containers
// ---------------------------------------------------------------------------

const activeContainers = new Set<DockerContainer>();

export function getActiveContainers(): ReadonlySet<DockerContainer> {
  return activeContainers;
}

export async function killAllActiveContainers(logger: Logger): Promise<void> {
  const containers = Array.from(activeContainers);
  if (containers.length === 0) return;
  logger.warn({ count: containers.length }, "killing all in-flight containers due to shutdown");
  await Promise.allSettled(
    containers.map((c) =>
      c.stop({ t: 5 }).catch((err: unknown) => {
        logger.debug({ err }, "container stop failed during shutdown");
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Main container execution
// ---------------------------------------------------------------------------

export async function runContainer(input: ContainerRunInput): Promise<ContainerResult> {
  const docker = createDockerClient();
  await ensureImage(docker, input.image, input.logger);

  const memLimit = getContainerMemoryLimitBytes();
  const nanoCpus = getContainerNanoCpus();

  const container = await docker.createContainer({
    Image: input.image,
    Cmd: input.cmd,
    Tty: false,
    Env: Object.entries(input.env).map(([k, v]) => `${k}=${v}`),
    AttachStdout: true,
    AttachStderr: true,
    HostConfig: {
      ...(memLimit !== null ? { Memory: memLimit } : {}),
      ...(nanoCpus !== null ? { NanoCpus: nanoCpus } : {}),
      ...(input.workspacePath ? { Binds: [`${input.workspacePath}:/workspace`] } : {}),
    },
    ...(input.workspacePath ? { WorkingDir: "/workspace" } : {}),
  });

  activeContainers.add(container);

  try {
    // Attach before start — avoids a race on fast-exiting containers.
    const stream = await container.attach({ stream: true, stdout: true, stderr: true });

    // Fix: use demuxStream to correctly separate stdout and stderr.
    const stdoutPass = new PassThrough();
    const stderrPass = new PassThrough();
    docker.modem.demuxStream(stream, stdoutPass, stderrPass);

    stdoutPass.on("data", (chunk: Buffer) => {
      input.onStdout(chunk);
    });
    stderrPass.on("data", (chunk: Buffer) => {
      input.onStderr(chunk);
    });

    eventBus.publish({
      id: randomUUID(),
      version: 1,
      type: "StageTimelineUpdated",
      occurredAt: new Date().toISOString(),
      source: `runner:${getRunnerId()}`,
      payload: {
        type: "StageTimelineUpdated",
        runId: input.runId,
        stageName: input.stageName,
        status: "Starting Container",
      },
    });

    await container.start();

    // Stats polling
    let samples = 0;
    let memBytesMax = 0;
    let memBytesSum = 0;
    let cpuPctMax = 0;
    let cpuPctSum = 0;
    let firstCpuTotal: number | null = null;
    let lastCpuTotal: number | null = null;

    const poll = async (): Promise<void> => {
      try {
        const raw = await (
          container as unknown as { stats: (opts: { stream: false }) => Promise<unknown> }
        ).stats({ stream: false });
        if (typeof raw !== "object" || raw === null) return;
        const s = raw as Record<string, unknown>;

        const memStats =
          typeof s.memory_stats === "object" && s.memory_stats !== null
            ? (s.memory_stats as Record<string, unknown>)
            : {};
        const usage = memStats.usage;
        if (typeof usage === "number" && Number.isFinite(usage)) {
          if (usage > memBytesMax) memBytesMax = usage;
          memBytesSum += usage;
        }

        const cpuPct = computeCpuPercent(raw);
        if (typeof cpuPct === "number" && Number.isFinite(cpuPct)) {
          if (cpuPct > cpuPctMax) cpuPctMax = cpuPct;
          cpuPctSum += cpuPct;
        }

        const cpuStats =
          typeof s.cpu_stats === "object" && s.cpu_stats !== null
            ? (s.cpu_stats as Record<string, unknown>)
            : {};
        const cpuUsage =
          typeof cpuStats.cpu_usage === "object" && cpuStats.cpu_usage !== null
            ? (cpuStats.cpu_usage as Record<string, unknown>)
            : {};
        const totalUsage = cpuUsage.total_usage;
        if (typeof totalUsage === "number" && Number.isFinite(totalUsage)) {
          firstCpuTotal ??= totalUsage;
          lastCpuTotal = totalUsage;
        }

        const netStats = computeNetworkStats(raw);
        const blkStats = computeBlockIo(raw);

        eventBus.publish({
          id: randomUUID(),
          version: 1,
          type: "StageMetricsUpdated",
          occurredAt: new Date().toISOString(),
          source: `runner:${getRunnerId()}`,
          payload: {
            type: "StageMetricsUpdated",
            runId: input.runId,
            stageName: input.stageName,
            cpuPercent: cpuPct ?? 0,
            memoryBytes: (typeof usage === "number" && Number.isFinite(usage)) ? usage : 0,
            memoryLimitBytes: memLimit ?? 0,
            networkRx: netStats.rx,
            networkTx: netStats.tx,
            blockRead: blkStats.read,
            blockWrite: blkStats.write,
          },
        });

        samples += 1;
      } catch (err) {
        input.logger.debug({ err }, "stats poll failed");
      }
    };

    await poll();
    const pollTimer = setInterval(() => {
      void poll();
    }, 1000);

    // Wait for container with optional timeout enforcement.
    let statusCode: number;
    const waitPromise = container.wait().then((result: unknown) => {
      const raw = result as Record<string, unknown>;
      const code = raw.StatusCode;
      return typeof code === "number" && Number.isFinite(code) ? code : 1;
    });

    if (input.timeoutMs !== null) {
      const timeoutMs = input.timeoutMs;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => {
          // Kill the container then reject so runStage can mark the stage failed.
          void container
            .stop({ t: 5 })
            .catch(() => undefined)
            .finally(() => {
              reject(new StageTimeoutError(input.stageName, timeoutMs));
            });
        }, timeoutMs),
      );
      statusCode = await Promise.race([waitPromise, timeoutPromise]);
    } else {
      statusCode = await waitPromise;
    }

    clearInterval(pollTimer);
    await poll();

    const cpuSeconds =
      typeof firstCpuTotal === "number" &&
      typeof lastCpuTotal === "number" &&
      lastCpuTotal >= firstCpuTotal
        ? (lastCpuTotal - firstCpuTotal) / 1e9
        : null;

    return {
      statusCode,
      cpuSeconds,
      cpuPercentAvg: samples > 0 ? cpuPctSum / samples : null,
      cpuPercentMax: samples > 0 ? cpuPctMax : null,
      memBytesMax: samples > 0 ? memBytesMax : null,
      memBytesAvg: samples > 0 ? memBytesSum / samples : null,
    };
  } finally {
    activeContainers.delete(container);
    await container.remove({ force: true }).catch((err: unknown) => {
      input.logger.debug({ err }, "container cleanup failed");
    });
  }
}
