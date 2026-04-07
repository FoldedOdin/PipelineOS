import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGetJson } from "../api/client";

interface FlakinessScore {
  stageName: string;
  windowSize: number;
  passes: number;
  fails: number;
  flakeScore: number;
}

interface FailureTrendPoint {
  day: string;
  totalRuns: number;
  failedRuns: number;
  successRuns: number;
}

interface StageCostAggregate {
  stageName: string;
  runs: number;
  totalCostUsd: number;
  avgCostUsd: number;
  maxCostUsd: number;
}

function heatmapColor(score: number | null): string {
  if (score === null) return "bg-slate-800/60";
  const s = Math.max(0, Math.min(1, score));
  if (s < 0.15) return "bg-emerald-900/70";
  if (s < 0.35) return "bg-amber-900/60";
  return "bg-rose-900/80";
}

export default function Dashboard(): ReactElement {
  const [params, setParams] = useSearchParams();
  const pipelineId = params.get("pipelineId") ?? "";

  const [flakiness, setFlakiness] = useState<FlakinessScore[] | undefined>(undefined);
  const [heatmapDays, setHeatmapDays] = useState<string[]>([]);
  const [heatmapStages, setHeatmapStages] = useState<{ stageName: string; cells: (number | null)[] }[]>([]);
  const [trend, setTrend] = useState<FailureTrendPoint[]>([]);
  const [stageCosts, setStageCosts] = useState<StageCostAggregate[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    if (pipelineId === "") {
      setFlakiness(undefined);
      setHeatmapDays([]);
      setHeatmapStages([]);
      setTrend([]);
      setStageCosts(undefined);
      return;
    }
    setError(undefined);
    try {
      const encoded = encodeURIComponent(pipelineId);
      const [flakinessRaw, heatRaw, trendRaw, costRaw] = await Promise.all([
        apiGetJson(`/api/analytics/flakiness?pipelineId=${encoded}`),
        apiGetJson(`/api/analytics/flakiness-heatmap?pipelineId=${encoded}&days=7`),
        apiGetJson(`/api/analytics/failure-trends?days=14`),
        apiGetJson(`/api/analytics/stage-costs?pipelineId=${encoded}&days=14&limit=10`),
      ]);

      const scores: FlakinessScore[] = [];
      if (typeof flakinessRaw === "object" && flakinessRaw !== null) {
        const arr = (flakinessRaw as Record<string, unknown>).scores;
        if (Array.isArray(arr)) {
          for (const row of arr) {
            if (typeof row !== "object" || row === null) continue;
            const r = row as Record<string, unknown>;
            const stageName = typeof r.stageName === "string" ? r.stageName : null;
            if (stageName === null) continue;
            const windowSize = typeof r.windowSize === "number" ? r.windowSize : 0;
            const passes = typeof r.passes === "number" ? r.passes : 0;
            const fails = typeof r.fails === "number" ? r.fails : 0;
            const flakeScore = typeof r.flakeScore === "number" ? r.flakeScore : 0;
            scores.push({ stageName, windowSize, passes, fails, flakeScore });
          }
        }
      }
      setFlakiness(scores);

      if (typeof heatRaw === "object" && heatRaw !== null) {
        const h = heatRaw as Record<string, unknown>;
        const days = Array.isArray(h.days) ? h.days.filter((d): d is string => typeof d === "string") : [];
        const stages: { stageName: string; cells: (number | null)[] }[] = [];
        if (Array.isArray(h.stages)) {
          for (const s of h.stages) {
            if (typeof s !== "object" || s === null) continue;
            const r = s as Record<string, unknown>;
            const stageName = typeof r.stageName === "string" ? r.stageName : null;
            if (stageName === null) continue;
            const cellsRaw = r.cells;
            const cells: (number | null)[] = [];
            if (Array.isArray(cellsRaw)) {
              for (const c of cellsRaw) {
                if (c === null) cells.push(null);
                else if (typeof c === "number" && Number.isFinite(c)) cells.push(c);
                else cells.push(null);
              }
            }
            stages.push({ stageName, cells });
          }
        }
        setHeatmapDays(days);
        setHeatmapStages(stages);
      }

      if (typeof trendRaw === "object" && trendRaw !== null) {
        const tr = (trendRaw as Record<string, unknown>).trend;
        const points: FailureTrendPoint[] = [];
        if (Array.isArray(tr)) {
          for (const p of tr) {
            if (typeof p !== "object" || p === null) continue;
            const o = p as Record<string, unknown>;
            const day = typeof o.day === "string" ? o.day : "";
            if (day === "") continue;
            points.push({
              day,
              totalRuns: typeof o.totalRuns === "number" ? o.totalRuns : 0,
              failedRuns: typeof o.failedRuns === "number" ? o.failedRuns : 0,
              successRuns: typeof o.successRuns === "number" ? o.successRuns : 0,
            });
          }
        }
        setTrend(points);
      }

      const costs: StageCostAggregate[] = [];
      if (typeof costRaw === "object" && costRaw !== null) {
        const arr = (costRaw as Record<string, unknown>).topStages;
        if (Array.isArray(arr)) {
          for (const row of arr) {
            if (typeof row !== "object" || row === null) continue;
            const r = row as Record<string, unknown>;
            const stageName = typeof r.stageName === "string" ? r.stageName : null;
            if (!stageName) continue;
            costs.push({
              stageName,
              runs: typeof r.runs === "number" ? r.runs : 0,
              totalCostUsd: typeof r.totalCostUsd === "number" ? r.totalCostUsd : 0,
              avgCostUsd: typeof r.avgCostUsd === "number" ? r.avgCostUsd : 0,
              maxCostUsd: typeof r.maxCostUsd === "number" ? r.maxCostUsd : 0,
            });
          }
        }
      }
      setStageCosts(costs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    }
  }, [pipelineId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, [load]);

  const maxFailed = useMemo(() => {
    let m = 1;
    for (const p of trend) {
      if (p.failedRuns > m) m = p.failedRuns;
    }
    return m;
  }, [trend]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Intelligence dashboard</h2>
          <p className="text-sm text-slate-400">Flakiness scores, heatmap (per stage × day), and run failure trends.</p>
        </div>
        <Link className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800" to="/runs">
          Runs
        </Link>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <label className="block text-sm font-medium text-slate-300" htmlFor="pipelineId">
          Pipeline ID
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="pipelineId"
            className="min-w-[260px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="e.g. owner/repo/workflow.yml"
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
        </div>
      </div>

      {error !== undefined ? (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">{error}</div>
      ) : null}

      {pipelineId === "" ? (
        <p className="text-sm text-slate-500">Enter a pipeline id to load flakiness and heatmap.</p>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Rolling window flakiness</h3>
            {flakiness === undefined ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : flakiness.length === 0 ? (
              <p className="text-sm text-slate-500">No stage outcomes yet. Complete runs to populate scores.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="min-w-full text-left text-sm text-slate-200">
                  <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2">Window</th>
                      <th className="px-3 py-2">Pass / fail</th>
                      <th className="px-3 py-2">Flake score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flakiness.map((row) => (
                      <tr key={row.stageName} className="border-t border-slate-800">
                        <td className="px-3 py-2 font-mono text-white">{row.stageName}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{String(row.windowSize)}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">
                          {String(row.passes)} / {String(row.fails)}
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-200">{row.flakeScore.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Heatmap (7 days, UTC)</h3>
            {heatmapStages.length === 0 ? (
              <p className="text-sm text-slate-500">No heatmap rows yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 border-b border-slate-800 bg-slate-950 px-2 py-2 text-left text-slate-400">
                        Stage
                      </th>
                      {heatmapDays.map((d) => (
                        <th key={d} className="border-b border-slate-800 px-1 py-2 text-center text-slate-500">
                          {d.slice(5)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapStages.map((row) => (
                      <tr key={row.stageName}>
                        <td className="sticky left-0 z-10 border-t border-slate-800 bg-slate-950 px-2 py-1 font-mono text-slate-200">
                          {row.stageName}
                        </td>
                        {row.cells.map((cell, i) => (
                          <td key={`${row.stageName}-${heatmapDays[i] ?? i}`} className="border-t border-slate-800 p-0.5">
                            <div
                              className={`h-8 w-8 rounded ${heatmapColor(cell)}`}
                              title={cell === null ? "no data" : `flake ${cell.toFixed(2)}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Deeper red = higher mixed pass/fail rate that day. Green = stable. Empty = no terminal outcomes.
            </p>
          </section>
        </>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Failure trend (all pipelines, last 14 days)</h3>
        {trend.length === 0 ? (
          <p className="text-sm text-slate-500">No completed runs in range.</p>
        ) : (
          <div className="space-y-2">
            {trend.map((p) => {
              const w = maxFailed > 0 ? Math.round((p.failedRuns / maxFailed) * 100) : 0;
              return (
                <div key={p.day} className="flex items-center gap-3 text-sm">
                  <div className="w-24 shrink-0 font-mono text-slate-400">{p.day}</div>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-slate-800">
                    <div className="h-full bg-rose-600/90" style={{ width: `${String(w)}%` }} />
                  </div>
                  <div className="w-24 shrink-0 text-right text-slate-400">
                    {String(p.failedRuns)} failed / {String(p.totalRuns)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {pipelineId !== "" ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Top stage cost (last 14 days)</h3>
          {stageCosts === undefined ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : stageCosts.length === 0 ? (
            <p className="text-sm text-slate-500">No cost metrics recorded yet. Run pipelines to populate stage costs.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Runs</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Avg</th>
                    <th className="px-3 py-2">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {stageCosts.map((row) => (
                    <tr key={row.stageName} className="border-t border-slate-800">
                      <td className="px-3 py-2 font-mono text-white">{row.stageName}</td>
                      <td className="px-3 py-2 font-mono text-slate-400">{String(row.runs)}</td>
                      <td className="px-3 py-2 font-mono text-amber-200">${row.totalCostUsd.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">${row.avgCostUsd.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">${row.maxCostUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Estimated cost uses runner env pricing (`COST_CPU_USD_PER_CPU_SECOND`, `COST_MEM_USD_PER_GB_SECOND`). Defaults to 0 until configured.
          </p>
        </section>
      ) : null}
    </div>
  );
}
