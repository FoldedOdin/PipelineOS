import type { Logger } from "pino";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function looksLikePlaceholder(value: string): boolean {
  return (
    value.startsWith("CHANGE_ME") || value === "same_as_above" || value === "random_string_here"
  );
}

function optionalEnv(name: string): string | null {
  const value = process.env[name];
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function validateRunnerConfig(logger: Logger): void {
  requiredEnv("API_URL");
  const internalKey = requiredEnv("INTERNAL_API_KEY");
  if (looksLikePlaceholder(internalKey)) {
    throw new Error("INTERNAL_API_KEY is a placeholder; set a real value");
  }

  const runnerId = requiredEnv("RUNNER_ID");
  if (looksLikePlaceholder(runnerId)) {
    throw new Error("RUNNER_ID is a placeholder; set a real value");
  }

  const maxConcurrentRaw = optionalEnv("MAX_CONCURRENT_RUNS");
  if (maxConcurrentRaw) {
    const n = Number(maxConcurrentRaw);
    if (!Number.isFinite(n) || n <= 0)
      throw new Error("MAX_CONCURRENT_RUNS must be a positive number");
  }

  logger.info("runner config validated");
}

export function getRunnerId(): string {
  return requiredEnv("RUNNER_ID");
}

export function getRunnerWorkspaceRoot(): string {
  return optionalEnv("RUNNER_WORKSPACE_ROOT") ?? "/tmp/pipelineos-workspaces";
}

export function getRetainWorkspaceOnFailure(): boolean {
  const val = optionalEnv("RUNNER_RETAIN_WORKSPACE_ON_FAILURE");
  return val === "true" || val === "1";
}

// ---------------------------------------------------------------------------
// Container resource limits
// ---------------------------------------------------------------------------

/**
 * Memory limit applied to every Docker container.
 * Reads `CONTAINER_MEMORY_LIMIT` (e.g. "512m", "1g", "1073741824").
 * Returns bytes, or `null` to apply no limit.
 */
export function getContainerMemoryLimitBytes(): number | null {
  const raw = optionalEnv("CONTAINER_MEMORY_LIMIT");
  if (!raw) return 512 * 1024 * 1024; // 512 MB default

  const lower = raw.toLowerCase();
  if (lower.endsWith("g")) {
    const n = parseFloat(lower);
    return Number.isFinite(n) ? Math.floor(n * 1024 * 1024 * 1024) : null;
  }
  if (lower.endsWith("m")) {
    const n = parseFloat(lower);
    return Number.isFinite(n) ? Math.floor(n * 1024 * 1024) : null;
  }
  if (lower.endsWith("k")) {
    const n = parseFloat(lower);
    return Number.isFinite(n) ? Math.floor(n * 1024) : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * CPU limit in NanoCPUs (1 CPU = 1_000_000_000 NanoCPUs).
 * Reads `CONTAINER_CPU_LIMIT` (e.g. "1", "0.5", "2.0").
 * Returns NanoCPUs, or `null` to apply no limit.
 */
export function getContainerNanoCpus(): number | null {
  const raw = optionalEnv("CONTAINER_CPU_LIMIT");
  if (!raw) return 1 * 1_000_000_000; // 1 CPU default
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n * 1_000_000_000);
}

// ---------------------------------------------------------------------------
// Stage timeout
// ---------------------------------------------------------------------------

/**
 * Default stage timeout in milliseconds.
 * Reads `DEFAULT_STAGE_TIMEOUT_MINUTES` (default: 30).
 * Returns `null` if set to "0" or "none" (disables timeout enforcement).
 */
export function getDefaultTimeoutMs(): number | null {
  const raw = optionalEnv("DEFAULT_STAGE_TIMEOUT_MINUTES");
  if (raw === "0" || raw === "none" || raw === "disabled") return null;
  const minutes = raw !== null ? Number(raw) : 30;
  if (!Number.isFinite(minutes) || minutes <= 0) return 30 * 60_000;
  return minutes * 60_000;
}
