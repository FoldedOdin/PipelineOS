import request from "supertest";
import { pino } from "pino";
import type { Logger } from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";

function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

describe("CORS middleware", () => {
  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS;
  });

  it("allows the local frontend origin to call the API", async () => {
    const app = createApp(createSilentLogger());

    const res = await request(app)
      .get("/health")
      .set("origin", "http://localhost:3000")
      .expect(200);

    expect(res.header["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.header.vary).toContain("Origin");
  });

  it("answers preflight requests for JSON and internal headers", async () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:3000";
    const app = createApp(createSilentLogger());

    const res = await request(app)
      .options("/api/runs")
      .set("origin", "http://localhost:3000")
      .set("access-control-request-method", "GET")
      .set("access-control-request-headers", "content-type,x-internal-api-key")
      .expect(204);

    expect(res.header["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.header["access-control-allow-methods"]).toContain("GET");
    expect(res.header["access-control-allow-headers"]).toContain("x-internal-api-key");
  });
});
