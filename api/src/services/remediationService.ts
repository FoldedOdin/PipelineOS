import { RemediationRule } from "../models/RemediationRule.js";

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

function toView(doc: {
  _id: unknown;
  enabled?: unknown;
  name?: unknown;
  match?: unknown;
  action?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}): RemediationRuleView | null {
  const id = typeof doc._id === "object" && doc._id !== null && "toString" in doc._id ? String((doc._id as { toString: () => string }).toString()) : null;
  const name = asNonEmptyString(doc.name);
  if (!id || !name) return null;
  const enabled = doc.enabled === undefined ? true : Boolean(doc.enabled);

  const matchObj = typeof doc.match === "object" && doc.match !== null ? (doc.match as Record<string, unknown>) : {};
  const pipelineId = asNonEmptyString(matchObj.pipelineId) ?? null;
  const stageName = asNonEmptyString(matchObj.stageName) ?? null;
  const anyPatterns = asStringArray(matchObj.anyPatterns, 20);
  const anyHintSubstrings = asStringArray(matchObj.anyHintSubstrings, 20);

  const actionObj = typeof doc.action === "object" && doc.action !== null ? (doc.action as Record<string, unknown>) : null;
  if (actionObj === null) return null;
  const type = actionObj.type === "retry_stage" ? "retry_stage" : null;
  if (type === null) return null;

  const maxAttempts = clampInt(actionObj.maxAttempts, 2, 1, 5);
  const backoffSeconds = clampInt(actionObj.backoffSeconds, 0, 0, 120);

  return {
    id,
    enabled,
    name,
    match: { pipelineId, stageName, anyPatterns, anyHintSubstrings },
    action: { type, maxAttempts, backoffSeconds },
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export const remediationService = {
  async listRules(pipelineId: string | null): Promise<RemediationRuleView[]> {
    const filter: Record<string, unknown> = {};
    if (pipelineId !== null) {
      filter.$or = [{ "match.pipelineId": null }, { "match.pipelineId": pipelineId }];
    }
    const docs = await RemediationRule.find(filter).sort({ createdAt: -1 }).lean<Record<string, unknown>[]>().exec();
    const views: RemediationRuleView[] = [];
    for (const d of docs) {
      const view = toView(d as unknown as { _id: unknown; createdAt?: Date; updatedAt?: Date });
      if (view) views.push(view);
    }
    return views;
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

    const created = await RemediationRule.create({
      enabled,
      name,
      match: { pipelineId, stageName, anyPatterns, anyHintSubstrings },
      action: { type, maxAttempts, backoffSeconds },
    });

    const reloaded = await RemediationRule.findById(created._id).lean<Record<string, unknown>>().exec();
    if (reloaded === null) return null;
    return toView(reloaded as unknown as { _id: unknown; createdAt?: Date; updatedAt?: Date });
  },

  async deleteRule(id: string): Promise<boolean> {
    const res = await RemediationRule.deleteOne({ _id: id }).exec();
    return res.deletedCount === 1;
  },
} as const;

