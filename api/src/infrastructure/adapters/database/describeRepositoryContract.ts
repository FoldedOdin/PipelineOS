import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { IPersistenceAdapter } from "../../../domain/index.js";

export function describeRepositoryContract(
  name: string,
  createAdapter: () => Promise<IPersistenceAdapter>,
  cleanup: () => Promise<void>
): void {
  describe(`Repository Contract: ${name}`, () => {
    let adapter: IPersistenceAdapter;

    beforeEach(async () => {
      adapter = await createAdapter();
      await adapter.connect();
      await adapter.migrate();
    });

    afterEach(async () => {
      if (adapter) {
        await adapter.disconnect();
      }
      await cleanup();
    });

    it("reports healthy after connection and migration", async () => {
      const health = await adapter.healthCheck();
      expect(health.connected).toBe(true);
    });

    it("supports creating and finding runs", async () => {
      const runRepo = adapter.runRepository;
      const created = await runRepo.create({
        pipelineId: "pipe-test-1",
        commitSha: "abc1234567890",
        branch: "main",
        triggeredBy: "user",
        event: "push",
        status: "queued",
      });

      expect(created.id).toBeDefined();
      expect(created.pipelineId).toBe("pipe-test-1");
      expect(created.status).toBe("queued");

      const fetched = await runRepo.findById(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.commitSha).toBe("abc1234567890");

      const byPipe = await runRepo.findByPipeline("pipe-test-1");
      expect(byPipe.length).toBeGreaterThanOrEqual(1);
    });

    it("supports atomic claiming of queued runs", async () => {
      const runRepo = adapter.runRepository;
      await runRepo.create({
        pipelineId: "pipe-claim",
        commitSha: "sha1",
        branch: "main",
        triggeredBy: "system",
        event: "push",
        status: "queued",
      });

      const nowStr = new Date().toISOString();
      const claimed = await runRepo.claimNextQueuedRun("runner-123", nowStr);
      expect(claimed).not.toBeNull();
      expect(claimed?.status).toBe("running");
      expect(claimed?.claimedBy).toBe("runner-123");
    });

    it("supports stage status updates", async () => {
      const runRepo = adapter.runRepository;
      const stageRepo = adapter.stageRepository;

      const run = await runRepo.create({
        pipelineId: "pipe-stage",
        commitSha: "sha2",
        branch: "dev",
        triggeredBy: "user",
        event: "push",
        stages: [
          {
            name: "build",
            status: "pending",
            image: "node:18",
            command: "npm run build",
            metrics: {
              cpuSeconds: null,
              cpuPercentAvg: null,
              cpuPercentMax: null,
              memBytesMax: null,
              costUsdEstimated: null,
            },
          },
        ],
      });

      const updated = await stageRepo.updateStatus(run.id, "build", {
        status: "success",
        exitCode: 0,
        durationMs: 1500,
      });

      expect(updated).not.toBeNull();
      expect(updated?.status).toBe("success");
      expect(updated?.exitCode).toBe(0);

      const stages = await stageRepo.findByRunId(run.id);
      expect(stages.length).toBe(1);
      expect(stages[0].status).toBe("success");
    });

    it("supports pipeline CRUD and upsertSummaryStats", async () => {
      const pipeRepo = adapter.pipelineRepository;
      const pipe = await pipeRepo.create({
        pipelineId: "p-crud",
        refSha: "initial-sha",
        rawYaml: "name: initial",
      });

      expect(pipe.pipelineId).toBe("p-crud");

      const upserted = await pipeRepo.upsertSummaryStats("p-crud", "new-sha", "name: updated");
      expect(upserted.refSha).toBe("new-sha");
      expect(upserted.rawYaml).toBe("name: updated");
    });

    it("supports remediation rule creation and matching", async () => {
      const ruleRepo = adapter.remediationRuleRepository;
      const rule = await ruleRepo.create({
        enabled: true,
        name: "Test Rule",
        match: {
          pipelineId: null,
          stageName: "test-stage",
          anyPatterns: ["TIMEOUT"],
          anyHintSubstrings: [],
        },
        action: {
          type: "retry_stage",
          maxAttempts: 3,
          backoffSeconds: 10,
        },
      });

      expect(rule.name).toBe("Test Rule");
      const active = await ruleRepo.findActive();
      expect(active.some((r) => r.id === rule.id)).toBe(true);
    });

    it("supports runner registration and heartbeats", async () => {
      const regRepo = adapter.runnerRegistrationRepository;
      const reg = await regRepo.registerOrHeartbeat({
        runnerId: "worker-node-1",
        lastHeartbeatAt: new Date(),
        status: "online",
        hostname: "host-1",
      });

      expect(reg.runnerId).toBe("worker-node-1");
      expect(reg.status).toBe("online");

      const fetched = await regRepo.findByRunnerId("worker-node-1");
      expect(fetched).not.toBeNull();
      expect(fetched?.hostname).toBe("host-1");
    });

    it("supports stage flakiness tracking", async () => {
      const flakinessRepo = adapter.stageFlakinessRepository;
      await flakinessRepo.recordStageOutcome({
        pipelineId: "pipe-flaky",
        stageName: "e2e",
        runId: "run-flaky-1",
        success: false,
        at: new Date(),
      });

      const record = await flakinessRepo.findByPipelineAndStage("pipe-flaky", "e2e");
      expect(record).not.toBeNull();
      expect(record?.outcomes.length).toBe(1);
      expect(record?.outcomes[0].success).toBe(false);
    });

    it("supports webhook delivery idempotency checks", async () => {
      const webhookRepo = adapter.webhookDeliveryRepository;
      const first = await webhookRepo.recordDelivery({
        deliveryId: "del-12345",
        event: "push",
        pipelineId: "pipe-web",
      });
      expect(first).toBe(true);

      const second = await webhookRepo.recordDelivery({
        deliveryId: "del-12345",
        event: "push",
        pipelineId: "pipe-web",
      });
      expect(second).toBe(false);
    });

    it("supports artifact creation and lookup", async () => {
      const runRepo = adapter.runRepository;
      const artifactRepo = adapter.artifactRepository;

      const run = await runRepo.create({
        pipelineId: "pipe-art",
        commitSha: "sha-art",
        branch: "main",
        triggeredBy: "user",
        event: "push",
      });

      const art = await artifactRepo.create({
        runId: run.id,
        stageName: "test",
        name: "coverage.zip",
        sizeBytes: 1024,
        contentType: "application/zip",
        storagePath: "/data/artifacts/coverage.zip",
      });

      expect(art.id).toBeDefined();
      expect(art.name).toBe("coverage.zip");

      const byRun = await artifactRepo.findByRunId(run.id);
      expect(byRun.length).toBe(1);
      expect(byRun[0].storagePath).toBe("/data/artifacts/coverage.zip");
    });
  });
}
