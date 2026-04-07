import type { Logger } from "pino";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function looksLikePlaceholder(value: string): boolean {
  return value.startsWith("CHANGE_ME") || value === "same_as_above" || value === "random_string_here" || value === "your_webhook_secret_here";
}

function optionalEnv(name: string): string | null {
  const value = process.env[name];
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function validateApiConfig(logger: Logger): void {
  const portRaw = optionalEnv("PORT") ?? "3001";
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number");
  }

  requiredEnv("MONGODB_URI");

  const internalKey = requiredEnv("INTERNAL_API_KEY");
  if (looksLikePlaceholder(internalKey)) {
    throw new Error("INTERNAL_API_KEY is a placeholder; set a real value");
  }

  const webhookSecret = requiredEnv("GITHUB_WEBHOOK_SECRET");
  if (looksLikePlaceholder(webhookSecret)) {
    throw new Error("GITHUB_WEBHOOK_SECRET is a placeholder; set a real value");
  }

  // GitHub App is optional in dev, but if any field is set, require all.
  const appId = optionalEnv("GITHUB_APP_ID");
  const privateKey = optionalEnv("GITHUB_APP_PRIVATE_KEY");
  const installationId = optionalEnv("GITHUB_APP_INSTALLATION_ID");
  const anyGithubApp = Boolean(appId || privateKey || installationId);
  if (anyGithubApp && (!appId || !privateKey || !installationId)) {
    throw new Error("GitHub App config incomplete: set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_INSTALLATION_ID");
  }

  logger.info({ githubAppConfigured: anyGithubApp }, "api config validated");
}

