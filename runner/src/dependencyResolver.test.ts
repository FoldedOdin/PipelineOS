import { describe, expect, it } from "vitest";
import { resolveStageOrder } from "./dependencyResolver.js";
import type { PipelineStage } from "./types.js";

function stage(name: string, depends_on: string[] = []): PipelineStage {
  return {
    name,
    image: "alpine:3.20",
    run: `echo ${name}`,
    depends_on,
    env: {},
    timeout_minutes: null,
  };
}

describe("resolveStageOrder", () => {
  it("orders stages so dependencies run first", () => {
    const order = resolveStageOrder([
      stage("build", ["install"]),
      stage("install"),
      stage("test", ["install"]),
    ]);

    expect(order.indexOf("install")).toBeLessThan(order.indexOf("build"));
    expect(order.indexOf("install")).toBeLessThan(order.indexOf("test"));
  });

  it("reports a readable cycle path", () => {
    expect(() =>
      resolveStageOrder([stage("a", ["b"]), stage("b", ["c"]), stage("c", ["a"])]),
    ).toThrow("cycle detected in depends_on: a -> b -> c -> a");
  });
});
