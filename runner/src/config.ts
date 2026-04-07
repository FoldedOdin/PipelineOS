import type { Logger } from "pino";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function looksLikePlaceholder(value: string): boolean {
  return value.startsWith("CHANGE_ME") || value === "same_as_above" || value === "random_string_here";
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

  const maxConcurrentRaw = optionalEnv("MAX_CONCURRENT_RUNS");
  if (maxConcurrentRaw) {
    const n = Number(maxConcurrentRaw);
    if (!Number.isFinite(n) || n <= 0) throw new Error("MAX_CONCURRENT_RUNS must be a positive number");
  }

  logger.info("runner config validated");
}

