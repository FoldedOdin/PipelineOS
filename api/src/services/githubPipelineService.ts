import crypto from "node:crypto";
import type { Logger } from "pino";

export function isGithubAppConfigured(): boolean {
  const appId = process.env.GITHUB_APP_ID;
  const key = process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  return Boolean(appId && key && installationId);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`${name} is required`);
  return value;
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function jsonB64Url(payload: unknown): string {
  return base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
}

function parsePemPrivateKey(pem: string): string {
  // Support envs that store newlines escaped as \n
  return pem.includes("\\n") ? pem.replaceAll("\\n", "\n") : pem;
}

function createGithubAppJwt(nowSeconds: number): string {
  const appId = requiredEnv("GITHUB_APP_ID");
  const pem = parsePemPrivateKey(requiredEnv("GITHUB_APP_PRIVATE_KEY"));

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: nowSeconds - 5,
    exp: nowSeconds + 9 * 60,
    iss: appId,
  };

  const encodedHeader = jsonB64Url(header);
  const encodedPayload = jsonB64Url(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(pem);
  const encodedSignature = base64UrlEncode(signature);
  return `${signingInput}.${encodedSignature}`;
}

async function getInstallationAccessToken(logger: Logger): Promise<string> {
  const installationId = requiredEnv("GITHUB_APP_INSTALLATION_ID");
  const jwt = createGithubAppJwt(Math.floor(Date.now() / 1000));

  const res = await fetch(`https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pipelineos-api",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    logger.warn({ status: res.status, body }, "failed to exchange installation token");
    throw new Error("github_installation_token_failed");
  }

  const json: unknown = await res.json();
  const token = typeof json === "object" && json !== null ? (json as Record<string, unknown>).token : undefined;
  if (typeof token !== "string" || token === "") throw new Error("github_installation_token_missing");
  return token;
}

export async function fetchPipelineYamlFromGithub(input: {
  pipelineId: string;
  refSha: string;
  logger: Logger;
}): Promise<string> {
  const { pipelineId, refSha, logger } = input;
  const [owner, repo] = pipelineId.split("/");
  if (!owner || !repo) throw new Error(`invalid pipelineId "${pipelineId}"`);

  const token = await getInstallationAccessToken(logger);

  const url =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
    `/contents/${encodeURIComponent(".pipelineos.yml")}?ref=${encodeURIComponent(refSha)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pipelineos-api",
    },
  });

  if (res.status === 404) throw new Error("pipeline_yaml_not_found");
  if (!res.ok) {
    const body = await res.text();
    logger.warn({ status: res.status, body, pipelineId }, "failed to fetch pipeline yaml from github");
    throw new Error("github_contents_fetch_failed");
  }

  const json: unknown = await res.json();
  const content = typeof json === "object" && json !== null ? (json as Record<string, unknown>).content : undefined;
  const encoding = typeof json === "object" && json !== null ? (json as Record<string, unknown>).encoding : undefined;
  if (typeof content !== "string" || typeof encoding !== "string") throw new Error("github_contents_invalid_response");
  if (encoding !== "base64") throw new Error(`unsupported github encoding: ${encoding}`);

  const raw = Buffer.from(content.replaceAll("\n", ""), "base64").toString("utf8");
  if (raw.trim() === "") throw new Error("pipeline_yaml_empty");
  return raw;
}

