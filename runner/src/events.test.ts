import { describe, it, expect, vi, beforeEach } from "vitest";
import { InProcessEventBus } from "./InProcessEventBus.js";
import type { RunnerDomainEvent } from "./events.js";

describe("InProcessEventBus", () => {
  let bus: InProcessEventBus;

  beforeEach(() => {
    bus = new InProcessEventBus();
  });

  it("delivers a published event to a matching subscriber", () => {
    const received: RunnerDomainEvent[] = [];
    bus.subscribe("RunClaimed", (e) => received.push(e));

    bus.publish({
      id: "evt-1",
      version: 1,
      type: "RunClaimed",
      occurredAt: new Date().toISOString(),
      source: "test",
      payload: {
        type: "RunClaimed",
        runId: "run-1",
        runnerId: "runner-a",
        pipelineId: "pipe-1",
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe("RunClaimed");
  });

  it("does not deliver events to non-matching subscribers", () => {
    const received: RunnerDomainEvent[] = [];
    bus.subscribe("RunFinished", (e) => received.push(e));

    bus.publish({
      id: "evt-2",
      version: 1,
      type: "RunClaimed",
      occurredAt: new Date().toISOString(),
      source: "test",
      payload: {
        type: "RunClaimed",
        runId: "run-2",
        runnerId: "runner-b",
        pipelineId: null,
      },
    });

    expect(received).toHaveLength(0);
  });

  it("delivers to multiple subscribers for the same event type", () => {
    const calls: string[] = [];
    bus.subscribe("StageStarted", () => calls.push("a"));
    bus.subscribe("StageStarted", () => calls.push("b"));

    bus.publish({
      id: "evt-3",
      version: 1,
      type: "StageStarted",
      occurredAt: new Date().toISOString(),
      source: "test",
      payload: {
        type: "StageStarted",
        runId: "run-3",
        stageName: "build",
        image: "node:20",
        attempt: 1,
      },
    });

    expect(calls).toEqual(["a", "b"]);
  });

  it("unsubscribes cleanly", () => {
    const received: RunnerDomainEvent[] = [];
    const unsub = bus.subscribe("RunFinished", (e) => received.push(e));

    bus.publish({
      id: "evt-4",
      version: 1,
      type: "RunFinished",
      occurredAt: new Date().toISOString(),
      source: "test",
      payload: {
        type: "RunFinished",
        runId: "run-4",
        status: "success",
        durationMs: 100,
      },
    });

    unsub();

    bus.publish({
      id: "evt-5",
      version: 1,
      type: "RunFinished",
      occurredAt: new Date().toISOString(),
      source: "test",
      payload: {
        type: "RunFinished",
        runId: "run-5",
        status: "failed",
        durationMs: 200,
      },
    });

    expect(received).toHaveLength(1);
  });

  it("swallows async handler errors without crashing", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    bus.subscribe("RunnerHeartbeat", async () => {
      throw new Error("handler boom");
    });

    bus.publish({
      id: "evt-6",
      version: 1,
      type: "RunnerHeartbeat",
      occurredAt: new Date().toISOString(),
      source: "test",
      payload: {
        type: "RunnerHeartbeat",
        runnerId: "runner-x",
        activeRuns: 0,
        maxConcurrentRuns: 1,
      },
    });

    // Give the microtask queue a chance to process the async rejection.
    await new Promise((r) => setTimeout(r, 10));

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles LogChunkReceived events with source field", () => {
    const chunks: string[] = [];
    bus.subscribe("LogChunkReceived", (e) => chunks.push(`${e.payload.source}:${e.payload.chunk}`));

    bus.publish({
      id: "evt-7",
      version: 1,
      type: "LogChunkReceived",
      occurredAt: new Date().toISOString(),
      source: "test",
      payload: {
        type: "LogChunkReceived",
        runId: "run-6",
        stageName: "test",
        chunk: "hello stdout",
        source: "stdout",
      },
    });

    bus.publish({
      id: "evt-8",
      version: 1,
      type: "LogChunkReceived",
      occurredAt: new Date().toISOString(),
      source: "test",
      payload: {
        type: "LogChunkReceived",
        runId: "run-6",
        stageName: "test",
        chunk: "hello stderr",
        source: "stderr",
      },
    });

    expect(chunks).toEqual(["stdout:hello stdout", "stderr:hello stderr"]);
  });
});
