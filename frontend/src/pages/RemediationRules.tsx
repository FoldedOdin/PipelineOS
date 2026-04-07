import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { internalDelete, internalGetJson, internalPostJson } from "../api/internalClient";

interface Rule {
  id: string;
  enabled: boolean;
  name: string;
  match: { pipelineId: string | null; stageName: string | null; anyPatterns: string[]; anyHintSubstrings: string[] };
  action: { type: "retry_stage"; maxAttempts: number; backoffSeconds: number };
  auto: { enabled: boolean; minAttempts: number; disableBelowSuccessRate: number };
  stats: { attempts: number; saves: number; failures: number; successRate: number };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function parseRules(payload: unknown): Rule[] {
  if (typeof payload !== "object" || payload === null) return [];
  const raw = (payload as Record<string, unknown>).rules;
  if (!Array.isArray(raw)) return [];
  const out: Rule[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    const id = asString(o.id);
    const name = asString(o.name);
    if (!id || !name) continue;
    const enabled = o.enabled !== false;
    const matchRaw = typeof o.match === "object" && o.match !== null ? (o.match as Record<string, unknown>) : {};
    const actionRaw = typeof o.action === "object" && o.action !== null ? (o.action as Record<string, unknown>) : null;
    const autoRaw = typeof o.auto === "object" && o.auto !== null ? (o.auto as Record<string, unknown>) : {};
    const statsRaw = typeof o.stats === "object" && o.stats !== null ? (o.stats as Record<string, unknown>) : {};
    if ((actionRaw?.type ?? null) !== "retry_stage") continue;
    const maxAttempts = asNumber(actionRaw.maxAttempts) ?? 1;
    const backoffSeconds = asNumber(actionRaw.backoffSeconds) ?? 0;
    out.push({
      id,
      enabled,
      name,
      match: {
        pipelineId: asString(matchRaw.pipelineId),
        stageName: asString(matchRaw.stageName),
        anyPatterns: asStringArray(matchRaw.anyPatterns),
        anyHintSubstrings: asStringArray(matchRaw.anyHintSubstrings),
      },
      action: {
        type: "retry_stage",
        maxAttempts,
        backoffSeconds,
      },
      auto: {
        enabled: asBool(autoRaw.enabled) ?? false,
        minAttempts: asNumber(autoRaw.minAttempts) ?? 10,
        disableBelowSuccessRate: asNumber(autoRaw.disableBelowSuccessRate) ?? 0.2,
      },
      stats: {
        attempts: asNumber(statsRaw.attempts) ?? 0,
        saves: asNumber(statsRaw.saves) ?? 0,
        failures: asNumber(statsRaw.failures) ?? 0,
        successRate: asNumber(statsRaw.successRate) ?? 0,
      },
    });
  }
  return out;
}

export default function RemediationRules(): ReactElement {
  const [params, setParams] = useSearchParams();
  const pipelineId = params.get("pipelineId") ?? "";

  const [rules, setRules] = useState<Rule[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setError(undefined);
    try {
      const q = pipelineId ? `?pipelineId=${encodeURIComponent(pipelineId)}` : "";
      const raw = await internalGetJson(`/internal/remediation/rules${q}`);
      setRules(parseRules(raw));
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
      setRules(undefined);
    }
  }, [pipelineId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    if (!rules) return [];
    return [...rules].sort((a, b) => (b.stats.successRate - a.stats.successRate) || (b.stats.attempts - a.stats.attempts));
  }, [rules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Remediation rules</h2>
          <p className="text-sm text-slate-400">Internal admin view (requires `VITE_INTERNAL_API_KEY`).</p>
        </div>
        <Link className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800" to="/dashboard">
          Dashboard
        </Link>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <label className="block text-sm font-medium text-slate-300" htmlFor="pipelineId">
          Pipeline ID (optional)
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="pipelineId"
            className="min-w-[260px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="owner/repo"
            defaultValue={pipelineId}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.trim();
                setParams(v ? { pipelineId: v } : {});
              }
            }}
          />
          <button
            type="button"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            onClick={() => {
              const el = document.getElementById("pipelineId") as HTMLInputElement | null;
              const v = el?.value.trim() ?? "";
              setParams(v ? { pipelineId: v } : {});
            }}
          >
            Load
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
      </div>

      {error !== undefined ? (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">{error}</div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-200">Create retry rule</h3>
          <button
            type="button"
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            disabled={creating}
            onClick={() => {
              setCreating(true);
              void (async () => {
                try {
                  await internalPostJson("/internal/remediation/rules", {
                    name: `Retry network timeouts${pipelineId ? ` (${pipelineId})` : ""}`,
                    enabled: true,
                    match: { pipelineId: pipelineId || null, stageName: null, anyPatterns: ["network_or_timeout"], anyHintSubstrings: [] },
                    action: { type: "retry_stage", maxAttempts: 2, backoffSeconds: 5 },
                    auto: { enabled: true, minAttempts: 10, disableBelowSuccessRate: 0.2 },
                  });
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "unknown error");
                } finally {
                  setCreating(false);
                }
              })();
            }}
          >
            Add example rule
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This page is intentionally internal-only until user auth exists. Use a separate admin deployment if needed.
        </p>
      </div>

      {rules === undefined ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-slate-500">No rules yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Stats</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-medium text-white">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{r.enabled ? "true" : "false"}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    <div>pipeline: {r.match.pipelineId ?? "any"}</div>
                    <div>stage: {r.match.stageName ?? "any"}</div>
                    <div>patterns: {r.match.anyPatterns.join(", ") || "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    retry x{String(r.action.maxAttempts)} (backoff {String(r.action.backoffSeconds)}s)
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    attempts {String(r.stats.attempts)} · saves {String(r.stats.saves)} · failures {String(r.stats.failures)} ·{" "}
                    <span className="text-amber-200">{(r.stats.successRate * 100).toFixed(1)}%</span>
                    {r.auto.enabled ? <span className="ml-2 text-emerald-400">auto</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-rose-300 hover:text-rose-200"
                      onClick={() => {
                        void (async () => {
                          try {
                            await internalDelete(`/internal/remediation/rules/${encodeURIComponent(r.id)}`);
                            await load();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "unknown error");
                          }
                        })();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

