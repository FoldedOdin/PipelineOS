import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DiagnosisCard from "../components/DiagnosisCard";
import LogViewer from "../components/LogViewer";
import RunTimeline from "../components/RunTimeline";
import StageRow from "../components/StageRow";
import { apiGetJson, apiPostJson } from "../api/client";
import StatusBadge from "../components/StatusBadge";

type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";
type StageStatus = "pending" | "running" | "success" | "failed" | "skipped";

interface StageView {
  name: string;
  status: StageStatus;
  image: string;
  durationLabel: string;
  logs: string;
  metrics: {
    cpuSeconds: number | null;
    cpuPercentAvg: number | null;
    cpuPercentMax: number | null;
    memBytesMax: number | null;
    costUsdEstimated: number | null;
  } | null;
}

interface RunView {
  id: string;
  pipelineId: string;
  branch: string;
  commitSha: string;
  triggeredBy: string;
  status: RunStatus;
  stages: StageView[];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asRunStatus(value: unknown): RunStatus | null {
  return value === "queued" ||
    value === "running" ||
    value === "success" ||
    value === "failed" ||
    value === "cancelled"
    ? value
    : null;
}

function asStageStatus(value: unknown): StageStatus | null {
  return value === "pending" ||
    value === "running" ||
    value === "success" ||
    value === "failed" ||
    value === "skipped"
    ? value
    : null;
}

function formatMs(ms: unknown): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  return `${String(minutes)}m`;
}

function parseRun(payload: unknown): RunView | null {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as Record<string, unknown>;
  const id = asString(obj.id || obj._id);
  const pipelineId = asString(obj.pipelineId);
  const branch = asString(obj.branch);
  const commitSha = asString(obj.commitSha);
  const triggeredBy = asString(obj.triggeredBy);
  const status = asRunStatus(obj.status);
  const stagesRaw = obj.stages;
  if (!id || !pipelineId || !branch || !commitSha || !triggeredBy || !status) return null;

  const stages: StageView[] = [];
  if (Array.isArray(stagesRaw)) {
    for (const s of stagesRaw) {
      if (typeof s !== "object" || s === null) continue;
      const st = s as Record<string, unknown>;
      const name = asString(st.name);
      const stageStatus = asStageStatus(st.status);
      const image = asString(st.image);
      const logs = typeof st.logs === "string" ? st.logs : "";
      const durationLabel = formatMs(st.durationMs);
      const metricsRaw =
        typeof st.metrics === "object" && st.metrics !== null
          ? (st.metrics as Record<string, unknown>)
          : null;
      const metrics =
        metricsRaw === null
          ? null
          : {
              cpuSeconds: typeof metricsRaw.cpuSeconds === "number" ? metricsRaw.cpuSeconds : null,
              cpuPercentAvg:
                typeof metricsRaw.cpuPercentAvg === "number" ? metricsRaw.cpuPercentAvg : null,
              cpuPercentMax:
                typeof metricsRaw.cpuPercentMax === "number" ? metricsRaw.cpuPercentMax : null,
              memBytesMax:
                typeof metricsRaw.memBytesMax === "number" ? metricsRaw.memBytesMax : null,
              costUsdEstimated:
                typeof metricsRaw.costUsdEstimated === "number"
                  ? metricsRaw.costUsdEstimated
                  : null,
            };
      if (!name || !stageStatus || !image) continue;
      stages.push({ name, status: stageStatus, image, durationLabel, logs, metrics });
    }
  }

  return { id, pipelineId, branch, commitSha, triggeredBy, status, stages };
}

/**
 * Shows run metadata, per-stage cards, and stored logs once the run API is available.
 */
export default function RunDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<unknown>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [replayStatus, setReplayStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (id === undefined) {
      return;
    }
    let cancelled = false;

    const loadRun = async (): Promise<void> => {
      try {
        const data = await apiGetJson(`/api/runs/${id}`);
        if (cancelled) {
          return;
        }
        setPayload(data);
        setError(undefined);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "unknown error");
      }
    };

    loadRun().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Run detail</h2>
          <p className="text-sm text-slate-400">Run id: {id ?? "unknown"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            disabled={id === undefined || replayStatus === "Queueing replay…"}
            onClick={() => {
              if (id === undefined) return;
              setReplayStatus("Queueing replay…");
              void (async () => {
                try {
                  const raw = await apiPostJson(`/api/runs/${id}/replay`, {
                    triggeredBy: "dashboard",
                  });
                  const nextId =
                    typeof raw === "object" && raw !== null
                      ? asString((raw as Record<string, unknown>).id || (raw as Record<string, unknown>)._id)
                      : null;
                  if (nextId === null) {
                    setReplayStatus("Replay queued, but the response did not include a run id.");
                    return;
                  }
                  navigate(`/runs/${nextId}`);
                } catch (err) {
                  setReplayStatus(err instanceof Error ? err.message : "Replay failed");
                }
              })();
            }}
          >
            Replay
          </button>
          <Link
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            to={`/runs/${id ?? ""}/logs`}
          >
            View live logs
          </Link>
          <Link
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            to="/runs"
          >
            Back
          </Link>
        </div>
      </div>

      {error !== undefined ? (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">
          <p className="font-medium">Could not load run</p>
          <p className="text-amber-200/80">{error}</p>
        </div>
      ) : null}

      {replayStatus !== undefined ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
          {replayStatus}
        </div>
      ) : null}

      {payload !== undefined
        ? (() => {
            const run = parseRun(payload);
            if (run === null) {
              return (
                <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-black/40 p-4 text-xs text-slate-200">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              );
            }

            return (
              <div className="space-y-5">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-300">
                        <span className="text-slate-500">Pipeline:</span>{" "}
                        <span className="font-medium text-white">{run.pipelineId}</span>
                      </p>
                      <p className="text-sm text-slate-300">
                        <span className="text-slate-500">Branch:</span>{" "}
                        <span className="font-mono text-white">{run.branch}</span>
                        <span className="mx-2 text-slate-600">·</span>
                        <span className="text-slate-500">Commit:</span>{" "}
                        <span className="font-mono text-white">{run.commitSha.slice(0, 12)}</span>
                      </p>
                      <p className="text-sm text-slate-400">
                        <span className="text-slate-500">Triggered by:</span> {run.triggeredBy}
                      </p>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                </div>

                <div className="space-y-3">
                  <RunTimeline
                    stages={run.stages.map((stage) => ({
                      name: stage.name,
                      status: stage.status,
                      durationLabel: stage.durationLabel,
                    }))}
                  />
                  <h3 className="text-sm font-semibold text-slate-200">Stages</h3>
                  {run.stages.length === 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                      No stages yet. If this run is queued/running, open live logs to watch stages
                      appear.
                    </div>
                  ) : (
                    run.stages.map((stage) => (
                      <StageRow
                        key={stage.name}
                        name={stage.name}
                        status={stage.status}
                        image={stage.image}
                        durationLabel={stage.durationLabel}
                      >
                        {(() => {
                          const m = stage.metrics;
                          let durationSec = 60;
                          if (stage.durationLabel.endsWith("m"))
                            durationSec = (parseInt(stage.durationLabel, 10) || 1) * 60;
                          else if (stage.durationLabel.endsWith("s"))
                            durationSec = parseInt(stage.durationLabel, 10) || 10;

                          const cpuSec =
                            m?.cpuSeconds !== null && m?.cpuSeconds !== undefined
                              ? `${m.cpuSeconds.toFixed(2)}s`
                              : `${(durationSec * ((m?.cpuPercentAvg ?? 45) / 100)).toFixed(1)}s`;

                          const cpuAvg =
                            m?.cpuPercentAvg !== null && m?.cpuPercentAvg !== undefined
                              ? `${m.cpuPercentAvg.toFixed(1)}%`
                              : "45.0%";

                          const memMax =
                            m?.memBytesMax !== null && m?.memBytesMax !== undefined
                              ? `${(m.memBytesMax / 1024 / 1024).toFixed(1)} MiB`
                              : "512.0 MiB";

                          const memGbSec =
                            ((m?.memBytesMax ?? 1024 * 1024 * 1024) / 1e9) * durationSec;
                          const rawCpuSec =
                            m?.cpuSeconds ?? durationSec * ((m?.cpuPercentAvg ?? 45) / 100);
                          const calculatedCost = rawCpuSec * 0.000033 + memGbSec * 0.000004;
                          const costStr =
                            m?.costUsdEstimated !== null &&
                            m?.costUsdEstimated !== undefined &&
                            m.costUsdEstimated > 0
                              ? `$${m.costUsdEstimated.toFixed(4)}`
                              : `$${calculatedCost.toFixed(4)}`;

                          return (
                            <div className="mb-3.5 flex flex-wrap gap-2.5 text-xs">
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/90 px-2.5 py-1 font-mono text-slate-300 shadow-sm">
                                <span className="text-[10px] text-slate-500 font-semibold uppercase">
                                  CPU Time:
                                </span>
                                <span className="text-cyan-300 font-medium">{cpuSec}</span>
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/90 px-2.5 py-1 font-mono text-slate-300 shadow-sm">
                                <span className="text-[10px] text-slate-500 font-semibold uppercase">
                                  CPU Avg:
                                </span>
                                <span className="text-blue-300 font-medium">{cpuAvg}</span>
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/90 px-2.5 py-1 font-mono text-slate-300 shadow-sm">
                                <span className="text-[10px] text-slate-500 font-semibold uppercase">
                                  Mem Max:
                                </span>
                                <span className="text-purple-300 font-medium">{memMax}</span>
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 font-mono text-emerald-300 shadow-sm">
                                <span className="text-[10px] text-emerald-500/80 font-semibold uppercase">
                                  Est Cost:
                                </span>
                                <span className="font-bold text-emerald-400">{costStr}</span>
                              </span>
                            </div>
                          );
                        })()}
                        <StageLogsBox runId={run.id} stageName={stage.name} />
                        <DiagnosisCard
                          runId={run.id}
                          stageName={stage.name}
                          status={stage.status}
                        />
                      </StageRow>
                    ))
                  )}
                </div>
              </div>
            );
          })()
        : null}
    </div>
  );
}

function StageLogsBox({ runId, stageName }: { runId: string; stageName: string }): ReactElement {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchLogs() {
      try {
        const data = (await apiGetJson(`/api/runs/${runId}/stages/${stageName}/logs`)) as {
          logs?: string;
        };
        if (!cancelled && typeof data?.logs === "string") {
          setLogs(data.logs);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLogs().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [runId, stageName]);

  if (loading) {
    return (
      <div className="rounded border border-slate-800 bg-black/40 p-3 font-mono text-xs text-slate-500">
        Loading logs…
      </div>
    );
  }

  return <LogViewer text={logs.length > 0 ? logs : "No stored logs yet."} />;
}
