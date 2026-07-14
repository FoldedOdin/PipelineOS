import { container } from "../bootstrap/index.js";
import type { RemediationRuleDTO } from "../domain/index.js";

export interface RemediationRuleView {
  id: string;
  enabled: boolean;
  name: string;
  match: {
    pipelineId: string | null;
    stageName: string | null;
    anyPatterns: string[];
    anyHintSubstrings: string[];
  };
  action: {
    type: "retry_stage";
    maxAttempts: number;
    backoffSeconds: number;
  };
  auto: {
    enabled: boolean;
    minAttempts: number;
    disableBelowSuccessRate: number;
  };
  stats: {
    attempts: number;
    saves: number;
    failures: number;
    successRate: number;
    lastAppliedAt: string | null;
    lastOutcomeAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    const s = asNonEmptyString(v);
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function dtoToView(dto: RemediationRuleDTO): RemediationRuleView {
  const attempts = dto.stats.attempts;
  const saves = dto.stats.saves;
  const failures = dto.stats.failures;
  const successRate = attempts > 0 ? saves / attempts : 0;

  return {
    id: dto.id,
    enabled: dto.enabled,
    name: dto.name,
    match: {
      pipelineId: dto.match.pipelineId,
      stageName: dto.match.stageName,
      anyPatterns: dto.match.anyPatterns,
      anyHintSubstrings: dto.match.anyHintSubstrings,
    },
    action: {
      type: dto.action.type,
      maxAttempts: dto.action.maxAttempts,
      backoffSeconds: dto.action.backoffSeconds,
    },
    auto: {
      enabled: dto.auto.enabled,
      minAttempts: dto.auto.minAttempts,
      disableBelowSuccessRate: dto.auto.disableBelowSuccessRate,
    },
    stats: {
      attempts,
      saves,
      failures,
      successRate,
      lastAppliedAt: dto.stats.lastAppliedAt?.toISOString() ?? null,
      lastOutcomeAt: dto.stats.lastOutcomeAt?.toISOString() ?? null,
    },
    createdAt: dto.createdAt.toISOString(),
    updatedAt: dto.updatedAt.toISOString(),
  };
}

export const remediationService = {
  async listRules(pipelineId: string | null): Promise<RemediationRuleView[]> {
    const all = await container.persistence.remediationRuleRepository.findAll();
    const filtered = pipelineId !== null
      ? all.filter((r) => r.match.pipelineId === null || r.match.pipelineId === pipelineId)
      : all;
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return filtered.map(dtoToView);
  },

  async createRule(body: unknown): Promise<RemediationRuleView | null> {
    if (typeof body !== "object" || body === null) return null;
    const obj = body as Record<string, unknown>;

    const name = asNonEmptyString(obj.name);
    if (name === null) return null;

    const enabled = obj.enabled === undefined ? true : Boolean(obj.enabled);
    const matchRaw = typeof obj.match === "object" && obj.match !== null ? (obj.match as Record<string, unknown>) : {};

    const pipelineId = asNonEmptyString(matchRaw.pipelineId) ?? null;
    const stageName = asNonEmptyString(matchRaw.stageName) ?? null;
    const anyPatterns = asStringArray(matchRaw.anyPatterns, 20);
    const anyHintSubstrings = asStringArray(matchRaw.anyHintSubstrings, 20);

    const actionRaw = typeof obj.action === "object" && obj.action !== null ? (obj.action as Record<string, unknown>) : null;
    if (actionRaw === null) return null;
    const type = actionRaw.type === "retry_stage" ? "retry_stage" : null;
    if (type === null) return null;

    const maxAttempts = clampInt(actionRaw.maxAttempts, 2, 1, 5);
    const backoffSeconds = clampInt(actionRaw.backoffSeconds, 0, 0, 120);

    const autoRaw = typeof obj.auto === "object" && obj.auto !== null ? (obj.auto as Record<string, unknown>) : {};
    const autoEnabled = autoRaw.enabled === true;
    const minAttempts = clampInt(autoRaw.minAttempts, 10, 1, 500);
    const disableBelowSuccessRateRaw =
      typeof autoRaw.disableBelowSuccessRate === "number" && Number.isFinite(autoRaw.disableBelowSuccessRate)
        ? autoRaw.disableBelowSuccessRate
        : 0.2;
    const disableBelowSuccessRate = Math.max(0, Math.min(1, disableBelowSuccessRateRaw));

    const created = await container.persistence.remediationRuleRepository.create({
      enabled,
      name,
      match: { pipelineId, stageName, anyPatterns, anyHintSubstrings },
      action: { type, maxAttempts, backoffSeconds },
      auto: { enabled: autoEnabled, minAttempts, disableBelowSuccessRate },
    });

    return dtoToView(created);
  },

  async recordRuleApplication(input: {
    ruleId: string;
    outcome: "attempt" | "save" | "failure";
  }): Promise<RemediationRuleView | null> {
    const rule = await container.persistence.remediationRuleRepository.findById(input.ruleId);
    if (!rule) return null;

    const now = new Date();
    const attempts = rule.stats.attempts + (input.outcome === "attempt" ? 1 : 0);
    const saves = rule.stats.saves + (input.outcome === "save" ? 1 : 0);
    const failures = rule.stats.failures + (input.outcome === "failure" ? 1 : 0);
    const lastAppliedAt = input.outcome === "attempt" ? now : rule.stats.lastAppliedAt;
    const lastOutcomeAt = now;

    let enabled = rule.enabled;
    const successRate = attempts > 0 ? saves / attempts : 0;
    if (rule.auto.enabled && enabled && attempts >= rule.auto.minAttempts && successRate < rule.auto.disableBelowSuccessRate) {
      enabled = false;
    }

    const updated = await container.persistence.remediationRuleRepository.update(rule.id, {
      enabled,
      stats: { attempts, saves, failures, lastAppliedAt, lastOutcomeAt },
    });
    if (!updated) return null;

    return dtoToView(updated);
  },

  async deleteRule(id: string): Promise<boolean> {
    return container.persistence.remediationRuleRepository.delete(id);
  },
} as const;
