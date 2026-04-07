import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LogViewer from "../components/LogViewer";
import StageRow from "../components/StageRow";
import { apiGetJson } from "../api/client";
import StatusBadge from "../components/StatusBadge";

type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";
type StageStatus = "pending" | "running" | "success" | "failed" | "skipped";

interface StageView {
  name: string;
  status: StageStatus;
  image: string;
  durationLabel: string;
  logs: string;
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
  return value === "queued" || value === "running" || value === "success" || value === "failed" || value === "cancelled" ? value : null;
}

function asStageStatus(value: unknown): StageStatus | null {
  return value === "pending" || value === "running" || value === "success" || value === "failed" || value === "skipped" ? value : null;
}

function formatMs(ms: unknown): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function parseRun(payload: unknown): RunView | null {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as Record<string, unknown>;
  const id = asString(obj._id);
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
      if (!name || !stageStatus || !image) continue;
      stages.push({ name, status: stageStatus, image, durationLabel, logs });
    }
  }

  return { id, pipelineId, branch, commitSha, triggeredBy, status, stages };
}

/**
 * Shows run metadata, per-stage cards, and stored logs once the run API is available.
 */
export default function RunDetail(): ReactElement {
  const { id } = useParams();
  const [payload, setPayload] = useState<unknown>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

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
          <Link
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            to={`/runs/${id ?? ""}/logs`}
          >
            View live logs
          </Link>
          <Link className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800" to="/runs">
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

      {payload !== undefined ? (
        (() => {
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
                      <span className="text-slate-500">Pipeline:</span> <span className="font-medium text-white">{run.pipelineId}</span>
                    </p>
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-500">Branch:</span> <span className="font-mono text-white">{run.branch}</span>
                      <span className="mx-2 text-slate-600">·</span>
                      <span className="text-slate-500">Commit:</span> <span className="font-mono text-white">{run.commitSha.slice(0, 12)}</span>
                    </p>
                    <p className="text-sm text-slate-400">
                      <span className="text-slate-500">Triggered by:</span> {run.triggeredBy}
                    </p>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Stages</h3>
                {run.stages.length === 0 ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                    No stages yet. If this run is queued/running, open live logs to watch stages appear.
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
                      <LogViewer text={stage.logs.length > 0 ? stage.logs : "No stored logs yet."} />
                    </StageRow>
                  ))
                )}
              </div>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
