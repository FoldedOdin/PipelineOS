import request from "supertest";
import { pino } from "pino";
import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    listRules: vi.fn(() => Promise.resolve([])),
    createRule: vi.fn(() => Promise.resolve(null)),
    deleteRule: vi.fn(() => Promise.resolve(false)),
    recordRuleApplication: vi.fn(() => Promise.resolve(null)),
  };
});

vi.mock("../services/remediationService.js", () => {
  return { remediationService: mocks };
});

import { createApp } from "../app.js";

function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

describe("remediation routes", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_KEY = "internal_test_key";
    mocks.listRules.mockClear();
    mocks.createRule.mockClear();
    mocks.deleteRule.mockClear();
    mocks.recordRuleApplication.mockClear();
  });

  it("requires the internal API key", async () => {
    const app = createApp(createSilentLogger());

    await request(app).get("/internal/remediation/rules").expect(401);
  });

  it("passes a trimmed pipeline filter to listRules", async () => {
    const app = createApp(createSilentLogger());

    await request(app)
      .get("/internal/remediation/rules?pipelineId=%20owner%2Frepo%20")
      .set("x-internal-api-key", "internal_test_key")
      .expect(200);

    expect(mocks.listRules).toHaveBeenCalledWith("owner/repo");
  });

  it("rejects invalid rule payloads", async () => {
    const app = createApp(createSilentLogger());

    await request(app)
      .post("/internal/remediation/rules")
      .set("x-internal-api-key", "internal_test_key")
      .send({})
      .expect(400);
  });

  it("rejects invalid remediation outcomes", async () => {
    const app = createApp(createSilentLogger());

    await request(app)
      .post("/internal/remediation/rules/rule-1/outcomes")
      .set("x-internal-api-key", "internal_test_key")
      .send({ outcome: "maybe" })
      .expect(400);

    expect(mocks.recordRuleApplication).not.toHaveBeenCalled();
  });
});
