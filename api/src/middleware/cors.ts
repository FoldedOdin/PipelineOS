import type { RequestHandler } from "express";

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
];
const allowedMethods = "GET,POST,PUT,DELETE,OPTIONS";
const allowedHeaders = [
  "content-type",
  "x-internal-api-key",
  "x-runner-id",
  "x-github-event",
  "x-github-delivery",
  "x-hub-signature-256",
  "x-request-id",
].join(",");

function configuredOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw === undefined || raw.trim() === "") return defaultAllowedOrigins;
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
}

function isAllowedOrigin(origin: string, allowed: string[]): boolean {
  return allowed.includes("*") || allowed.includes(origin);
}

export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.header("origin");
  if (origin !== undefined && isAllowedOrigin(origin, configuredOrigins())) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", allowedMethods);
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") {
    res.status(204).send();
    return;
  }

  next();
};
