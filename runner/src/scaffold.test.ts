import { describe, expect, it } from "vitest";
import { createDockerClient } from "./docker.js";

describe("runner scaffold", () => {
  it("creates a dockerode client configuration", () => {
    const docker = createDockerClient("/var/run/docker.sock");
    expect(docker).toBeDefined();
  });
});
