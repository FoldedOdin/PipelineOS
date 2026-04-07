/**
 * Topological ordering of stages from `depends_on`, with cycle detection.
 */
import type { PipelineStage } from "./types.js";

export function resolveStageOrder(stages: PipelineStage[]): string[] {
  const byName = new Map<string, PipelineStage>();
  for (const s of stages) byName.set(s.name, s);

  const temporary = new Set<string>();
  const permanent = new Set<string>();
  const result: string[] = [];

  const visit = (name: string, stack: string[]): void => {
    if (permanent.has(name)) return;
    if (temporary.has(name)) {
      const cycle = [...stack, name].join(" -> ");
      throw new Error(`cycle detected in depends_on: ${cycle}`);
    }
    temporary.add(name);
    const node = byName.get(name);
    if (!node) throw new Error(`missing stage "${name}"`);
    for (const dep of node.depends_on) visit(dep, [...stack, name]);
    temporary.delete(name);
    permanent.add(name);
    result.push(name);
  };

  for (const s of stages) visit(s.name, []);
  return result;
}
