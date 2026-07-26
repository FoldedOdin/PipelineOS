/**
 * Tests for api-client.ts
 *
 * Strategy: mock globalThis.fetch and verify that each function sends the
 * correct method, path, headers, and body to the control plane API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Environment setup ──────────────────────────────────────────────────────
const env = {
  API_URL: "http://api.test",
  INTERNAL_API_KEY: "secret-key",
  RUNNER_ID: "runner-001",
};

beforeEach(() => {
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }
});

afterEach(() => {
  for (const k of Object.keys(env)) {
    delete process.env[k];
  }
  vi.restoreAllMocks();
});

function makeOkResponse(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeEmptyResponse(status: number): Response {
  return new Response(null, { status });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("apiFetch", () => {
  it("injects required auth headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse());
    const { apiFetch } = await import("./api-client.js");
    await apiFetch("/test");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/test");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-internal-api-key"]).toBe("secret-key");
    expect(headers["x-runner-id"]).toBe("runner-001");
  });
});

describe("claimNextRun", () => {
  it("returns null on 204 (no queued run)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(makeEmptyResponse(204));
    const { claimNextRun } = await import("./api-client.js");
    const result = await claimNextRun({ warn: vi.fn(), debug: vi.fn() } as never);
    expect(result).toBeNull();
  });

  it("returns null and logs on non-2xx", async () => {
    const warn = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("error", { status: 500 }));
    const { claimNextRun } = await import("./api-client.js");
    const result = await claimNextRun({ warn, debug: vi.fn() } as never);
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("returns a ClaimedRun on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeOkResponse({ _id: "run-abc", pipelineId: "pipe-1", commitSha: "abc123" }),
    );
    const { claimNextRun } = await import("./api-client.js");
    const result = await claimNextRun({ warn: vi.fn(), debug: vi.fn() } as never);
    expect(result).not.toBeNull();
    expect(result?._id).toBe("run-abc");
    expect(result?.pipelineId).toBe("pipe-1");
  });
});

describe("setRunStatus", () => {
  it("posts to the correct endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse());
    const { setRunStatus } = await import("./api-client.js");
    await setRunStatus("run-1", "success");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/internal/runs/run-1/status");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ status: "success" });
  });
});

describe("appendLogs", () => {
  it("posts log chunk to the correct endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse());
    const { appendLogs } = await import("./api-client.js");
    await appendLogs("run-1", "build", "hello\n");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/internal/runs/run-1/stages/build/logs");
    expect(JSON.parse(init.body as string)).toEqual({ logs: "hello\n" });
  });
});

describe("fetchRemediationRules", () => {
  it("returns an empty array on non-2xx", async () => {
    const warn = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));
    const { fetchRemediationRules } = await import("./api-client.js");
    const rules = await fetchRemediationRules("pipe-1", { warn, debug: vi.fn() } as never);
    expect(rules).toEqual([]);
  });

  it("parses retry_stage rules from response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeOkResponse({
        rules: [
          {
            id: "rule-1",
            enabled: true,
            name: "retry on fail",
            match: { anyPatterns: [], anyHintSubstrings: [] },
            action: { type: "retry_stage", maxAttempts: 3, backoffSeconds: 5 },
          },
        ],
      }),
    );
    const { fetchRemediationRules } = await import("./api-client.js");
    const rules = await fetchRemediationRules("pipe-1", { warn: vi.fn() } as never);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.action.maxAttempts).toBe(3);
  });
});

describe("fetchSecrets", () => {
  it("returns key-value pairs from response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeOkResponse({ DB_PASSWORD: "hunter2", API_KEY: "xyz" }),
    );
    const { fetchSecrets } = await import("./api-client.js");
    const secrets = await fetchSecrets({ warn: vi.fn() } as never);
    expect(secrets).toEqual({ DB_PASSWORD: "hunter2", API_KEY: "xyz" });
  });
});

describe("pingRunnerHeartbeat", () => {
  it("posts to /internal/runners/heartbeat", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse());
    const { pingRunnerHeartbeat } = await import("./api-client.js");
    await pingRunnerHeartbeat({ debug: vi.fn() } as never, 2, 4);

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/internal/runners/heartbeat");
  });

  it("does not throw on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { pingRunnerHeartbeat } = await import("./api-client.js");
    await expect(pingRunnerHeartbeat({ debug: vi.fn() } as never, 0, 1)).resolves.toBeUndefined();
  });
});
