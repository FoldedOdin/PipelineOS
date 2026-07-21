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
      type: "RunClaimed",
      runId: "run-1",
      runnerId: "runner-a",
      pipelineId: "pipe-1",
      ts: new Date(),
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe("RunClaimed");
  });

  it("does not deliver events to non-matching subscribers", () => {
    const received: RunnerDomainEvent[] = [];
    bus.subscribe("RunFinished", (e) => received.push(e));

    bus.publish({
      type: "RunClaimed",
      runId: "run-2",
      runnerId: "runner-b",
      pipelineId: null,
      ts: new Date(),
    });

    expect(received).toHaveLength(0);
  });

  it("delivers to multiple subscribers for the same event type", () => {
    const calls: string[] = [];
    bus.subscribe("StageStarted", () => calls.push("a"));
    bus.subscribe("StageStarted", () => calls.push("b"));

    bus.publish({
      type: "StageStarted",
      runId: "run-3",
      stageName: "build",
      image: "node:20",
      attempt: 1,
      ts: new Date(),
    });

    expect(calls).toEqual(["a", "b"]);
  });

  it("unsubscribes cleanly", () => {
    const received: RunnerDomainEvent[] = [];
    const unsub = bus.subscribe("RunFinished", (e) => received.push(e));

    bus.publish({
      type: "RunFinished",
      runId: "run-4",
      status: "success",
      durationMs: 100,
      ts: new Date(),
    });

    unsub();

    bus.publish({
      type: "RunFinished",
      runId: "run-5",
      status: "failed",
      durationMs: 200,
      ts: new Date(),
    });

    expect(received).toHaveLength(1);
  });

  it("swallows async handler errors without crashing", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    bus.subscribe("RunnerHeartbeat", async () => {
      throw new Error("handler boom");
    });

    bus.publish({
      type: "RunnerHeartbeat",
      runnerId: "runner-x",
      activeRuns: 0,
      maxConcurrentRuns: 1,
      ts: new Date(),
    });

    // Give the microtask queue a chance to process the async rejection.
    await new Promise((r) => setTimeout(r, 10));

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles LogChunkReceived events with source field", () => {
    const chunks: string[] = [];
    type LogChunk = Extract<RunnerDomainEvent, { type: "LogChunkReceived" }>;
    bus.subscribe<LogChunk>("LogChunkReceived", (e) => chunks.push(`${e.source}:${e.chunk}`));

    bus.publish({
      type: "LogChunkReceived",
      runId: "run-6",
      stageName: "test",
      chunk: "hello stdout",
      source: "stdout",
      ts: new Date(),
    });
    bus.publish({
      type: "LogChunkReceived",
      runId: "run-6",
      stageName: "test",
      chunk: "hello stderr",
      source: "stderr",
      ts: new Date(),
    });

    expect(chunks).toEqual(["stdout:hello stdout", "stderr:hello stderr"]);
  });
});
