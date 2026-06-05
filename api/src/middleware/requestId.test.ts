import request from "supertest";
import { pino } from "pino";
import type { Logger } from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

describe("request id middleware", () => {
  it("echoes an incoming request id", async () => {
    const app = createApp(createSilentLogger());

    const res = await request(app).get("/health").set("x-request-id", "req-test-1").expect(200);

    expect(res.header["x-request-id"]).toBe("req-test-1");
  });

  it("creates a request id when one is missing", async () => {
    const app = createApp(createSilentLogger());

    const res = await request(app).get("/health").expect(200);

    expect(res.header["x-request-id"]).toMatch(/[a-f0-9-]{36}/);
  });
});
