import type { Database } from "better-sqlite3";
import crypto from "node:crypto";

export class SeedRunner {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async runSeeds(logger?: unknown): Promise<void> {
    // Check if remediation_rules table exists before seeding
    const tableCheck = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='remediation_rules'")
      .get();

    if (!tableCheck) {
      return;
    }

    const countRow = this.db.prepare("SELECT COUNT(*) as count FROM remediation_rules").get() as {
      count: number;
    };
    if (countRow && countRow.count > 0) {
      return;
    }

    const seedRuleId = `rule-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const insertRule = this.db.prepare(`
      INSERT INTO remediation_rules (
        id, enabled, name, pipeline_id, stage_name, match_json, action_json, auto_json, stats_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const matchJson = JSON.stringify({
      pipelineId: null,
      stageName: null,
      anyPatterns: ["ETIMEDOUT", "ECONNRESET", "network timeout at"],
      anyHintSubstrings: ["try again", "network error"],
    });

    const actionJson = JSON.stringify({
      type: "retry_stage",
      maxAttempts: 2,
      backoffSeconds: 5,
    });

    const autoJson = JSON.stringify({
      enabled: true,
      minAttempts: 10,
      disableBelowSuccessRate: 0.2,
    });

    const statsJson = JSON.stringify({
      attempts: 0,
      saves: 0,
      failures: 0,
      lastAppliedAt: null,
      lastOutcomeAt: null,
    });

    this.db.transaction(() => {
      insertRule.run(
        seedRuleId,
        1,
        "Auto-Retry NPM/Yarn Network Timeouts",
        null,
        null,
        matchJson,
        actionJson,
        autoJson,
        statsJson,
        now,
        now,
      );
    })();

    if (
      logger &&
      typeof logger === "object" &&
      "info" in logger &&
      typeof (logger as { info: unknown }).info === "function"
    ) {
      (logger as { info: (msg: string) => void }).info("seeded default remediation rules");
    }
  }
}
