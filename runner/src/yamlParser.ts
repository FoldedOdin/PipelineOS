/**
 * Parses and validates `.pipelineos.yml` contents against the Phase 1 schema.
 */
import { parse as parseYaml } from "yaml";
import type { PipelineDefinition, PipelineStage, PipelineTrigger } from "./types.js";

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`invalid ${field}: expected non-empty string`);
  }
  return value;
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`invalid ${field}: expected array`);
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") throw new Error(`invalid ${field}: expected string values`);
    items.push(item);
  }
  return items;
}

function readOptionalStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  return readStringArray(value, field);
}

function readOptionalEnv(value: unknown, field: string): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid ${field}: expected mapping`);
  }
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== "string") throw new Error(`invalid ${field}.${k}: expected string`);
    env[k] = v;
  }
  return env;
}

function readOptionalInt(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`invalid ${field}: expected positive integer`);
  }
  return value;
}

function isTrigger(value: string): value is PipelineTrigger {
  return value === "push" || value === "pull_request";
}

export function parsePipelineYaml(raw: string): PipelineDefinition {
  const doc: unknown = parseYaml(raw);
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new Error("invalid yaml: expected mapping at root");
  }

  const root = doc as Record<string, unknown>;
  const name = requiredString(root.name, "name");
  const onValues = readStringArray(root.on, "on");
  const on: PipelineTrigger[] = onValues.map((v) => {
    if (!isTrigger(v)) throw new Error(`invalid on: unsupported trigger "${v}"`);
    return v;
  });

  if (!Array.isArray(root.stages)) throw new Error("invalid stages: expected array");
  const stages: PipelineStage[] = root.stages.map((s, idx) => {
    if (typeof s !== "object" || s === null || Array.isArray(s)) {
      throw new Error(`invalid stages[${String(idx)}]: expected mapping`);
    }
    const stage = s as Record<string, unknown>;
    const stageName = requiredString(stage.name, `stages[${String(idx)}].name`);
    const image = requiredString(stage.image, `stages[${String(idx)}].image`);
    const run = requiredString(stage.run, `stages[${String(idx)}].run`);
    const depends_on = readOptionalStringArray(stage.depends_on, `stages[${String(idx)}].depends_on`);
    const env = readOptionalEnv(stage.env, `stages[${String(idx)}].env`);
    const timeout_minutes = readOptionalInt(stage.timeout_minutes, `stages[${String(idx)}].timeout_minutes`);
    return { name: stageName, image, run, depends_on, env, timeout_minutes };
  });

  const nameSet = new Set<string>();
  for (const s of stages) {
    if (nameSet.has(s.name)) throw new Error(`invalid stages: duplicate stage name "${s.name}"`);
    nameSet.add(s.name);
  }
  for (const s of stages) {
    for (const dep of s.depends_on) {
      if (!nameSet.has(dep)) throw new Error(`invalid stages: "${s.name}" depends_on missing stage "${dep}"`);
    }
  }

  return { name, on, stages };
}
