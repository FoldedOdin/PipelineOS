import request from "supertest";
import { pino } from "pino";
import type { Logger } from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

function isHealthPayload(value: unknown): value is { status: string; timestamp: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("status" in value) || !("timestamp" in value)) {
    return false;
  }
  const candidate = value as { status: unknown; timestamp: unknown };
  return typeof candidate.status === "string" && typeof candidate.timestamp === "string";
}

function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

describe("GET /health", () => {
  it("returns status ok and ISO timestamp", async () => {
    const app = createApp(createSilentLogger());
    const res = await request(app).get("/health").expect(200);
    expect(isHealthPayload(res.body)).toBe(true);
    if (!isHealthPayload(res.body)) {
      throw new Error("unexpected health payload shape");
    }
    expect(res.body.status).toBe("ok");
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });
});
