/**
 * Tests for container-runner.ts
 *
 * Strategy: mock `dockerode` and the docker client to verify lifecycle
 * contracts without spinning up real containers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Shared mock helpers ────────────────────────────────────────────────────

function makeStream() {
  const { PassThrough } = require("node:stream") as typeof import("node:stream");
  return new PassThrough();
}

function buildMockDocker(overrides: Record<string, unknown> = {}) {
  const mockWait = vi.fn().mockResolvedValue({ StatusCode: 0 });
  const mockStart = vi.fn().mockResolvedValue(undefined);
  const mockAttach = vi.fn().mockResolvedValue(makeStream());
  const mockRemove = vi.fn().mockResolvedValue(undefined);
  const mockStop = vi.fn().mockResolvedValue(undefined);
  const mockStats = vi.fn().mockResolvedValue({});
  const mockInspect = vi.fn().mockResolvedValue({});

  const mockContainer = {
    wait: mockWait,
    start: mockStart,
    attach: mockAttach,
    remove: mockRemove,
    stop: mockStop,
    stats: mockStats,
  };

  const mockDockerInstance = {
    createContainer: vi.fn().mockResolvedValue(mockContainer),
    getImage: vi.fn().mockReturnValue({ inspect: mockInspect }),
    pull: vi.fn(),
    modem: {
      demuxStream: vi.fn(),
      followProgress: vi.fn(),
    },
    ...overrides,
  };

  return { mockDockerInstance, mockContainer, mockWait, mockStart, mockAttach };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("container-runner: runContainer", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("uses demuxStream (not double-pipe) to separate stdout and stderr", async () => {
    const { mockDockerInstance } = buildMockDocker();

    vi.doMock("./docker.js", () => ({
      createDockerClient: () => mockDockerInstance,
    }));
    vi.doMock("./config.js", () => ({
      getContainerMemoryLimitBytes: () => null,
      getContainerNanoCpus: () => null,
      getRunnerWorkspaceRoot: () => "/tmp",
      getRetainWorkspaceOnFailure: () => false,
      getDefaultTimeoutMs: () => null,
    }));

    const { runContainer } = await import("./container-runner.js");

    await runContainer({
      image: "alpine:3.20",
      cmd: ["echo", "hi"],
      env: {},
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      workspacePath: null,
      stageName: "test",
      timeoutMs: null,
    });

    // demuxStream should be called instead of stream.pipe
    expect(mockDockerInstance.modem.demuxStream).toHaveBeenCalledOnce();
  });

  it("applies memory and cpu limits to createContainer", async () => {
    const { mockDockerInstance } = buildMockDocker();

    vi.doMock("./docker.js", () => ({
      createDockerClient: () => mockDockerInstance,
    }));
    vi.doMock("./config.js", () => ({
      getContainerMemoryLimitBytes: () => 512 * 1024 * 1024,
      getContainerNanoCpus: () => 1_000_000_000,
      getRunnerWorkspaceRoot: () => "/tmp",
      getRetainWorkspaceOnFailure: () => false,
      getDefaultTimeoutMs: () => null,
    }));

    const { runContainer } = await import("./container-runner.js");

    await runContainer({
      image: "alpine:3.20",
      cmd: ["true"],
      env: {},
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      workspacePath: null,
      stageName: "test",
      timeoutMs: null,
    });

    const createArgs = mockDockerInstance.createContainer.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const hostConfig = createArgs?.HostConfig as Record<string, unknown>;
    expect(hostConfig?.Memory).toBe(512 * 1024 * 1024);
    expect(hostConfig?.NanoCpus).toBe(1_000_000_000);
  });

  it("throws StageTimeoutError and stops container on timeout", async () => {
    const { mockDockerInstance, mockContainer } = buildMockDocker({});
    // Make wait() hang forever
    mockContainer.wait = vi.fn(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );
    mockContainer.stop = vi.fn().mockResolvedValue(undefined);

    vi.doMock("./docker.js", () => ({
      createDockerClient: () => mockDockerInstance,
    }));
    vi.doMock("./config.js", () => ({
      getContainerMemoryLimitBytes: () => null,
      getContainerNanoCpus: () => null,
      getRunnerWorkspaceRoot: () => "/tmp",
      getRetainWorkspaceOnFailure: () => false,
      getDefaultTimeoutMs: () => null,
    }));

    const { runContainer, StageTimeoutError } = await import("./container-runner.js");

    await expect(
      runContainer({
        image: "alpine:3.20",
        cmd: ["sleep", "99"],
        env: {},
        onStdout: vi.fn(),
        onStderr: vi.fn(),
        logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
        workspacePath: null,
        stageName: "slow-stage",
        timeoutMs: 50, // 50ms timeout in test
      }),
    ).rejects.toThrow(StageTimeoutError);

    expect(mockContainer.stop).toHaveBeenCalled();
  });

  it("removes the container in the finally block even on success", async () => {
    const { mockDockerInstance, mockContainer } = buildMockDocker();

    vi.doMock("./docker.js", () => ({
      createDockerClient: () => mockDockerInstance,
    }));
    vi.doMock("./config.js", () => ({
      getContainerMemoryLimitBytes: () => null,
      getContainerNanoCpus: () => null,
      getRunnerWorkspaceRoot: () => "/tmp",
      getRetainWorkspaceOnFailure: () => false,
      getDefaultTimeoutMs: () => null,
    }));

    const { runContainer } = await import("./container-runner.js");

    await runContainer({
      image: "alpine:3.20",
      cmd: ["true"],
      env: {},
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      workspacePath: null,
      stageName: "cleanup-test",
      timeoutMs: null,
    });

    expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
  });

  it("mounts workspace volume when workspacePath is provided", async () => {
    const { mockDockerInstance } = buildMockDocker();

    vi.doMock("./docker.js", () => ({
      createDockerClient: () => mockDockerInstance,
    }));
    vi.doMock("./config.js", () => ({
      getContainerMemoryLimitBytes: () => null,
      getContainerNanoCpus: () => null,
      getRunnerWorkspaceRoot: () => "/tmp",
      getRetainWorkspaceOnFailure: () => false,
      getDefaultTimeoutMs: () => null,
    }));

    const { runContainer } = await import("./container-runner.js");

    await runContainer({
      image: "alpine:3.20",
      cmd: ["ls"],
      env: {},
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      workspacePath: "/tmp/workspaces/run-42",
      stageName: "ls-test",
      timeoutMs: null,
    });

    const createArgs = mockDockerInstance.createContainer.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const hostConfig = createArgs?.HostConfig as Record<string, unknown>;
    expect((hostConfig?.Binds as string[])?.some((b: string) => b.includes("/workspace"))).toBe(true);
  });
});
