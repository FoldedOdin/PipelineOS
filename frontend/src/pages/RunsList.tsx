import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRuns } from "../hooks/useRuns";
import StatusBadge from "../components/StatusBadge";

type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";

interface RunRow {
  id: string;
  status: RunStatus;
  pipelineId: string;
  branch: string;
  commitSha: string;
  triggeredBy: string;
  startedAt: string | null;
  finishedAt: string | null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asRunStatus(value: unknown): RunStatus | null {
  return value === "queued" || value === "running" || value === "success" || value === "failed" || value === "cancelled" ? value : null;
}

function formatDurationMs(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) return "—";
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  return `${String(minutes)}m`;
}

function parseRunsList(payload: unknown): { items: RunRow[]; total: number } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as Record<string, unknown>;
  const itemsRaw = obj.items;
  const totalRaw = obj.total;
  const total = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : 0;
  if (!Array.isArray(itemsRaw)) return null;

  const items: RunRow[] = [];
  for (const item of itemsRaw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const id = asString(r._id);
    const status = asRunStatus(r.status);
    const pipelineId = asString(r.pipelineId);
    const branch = asString(r.branch);
    const commitSha = asString(r.commitSha);
    const triggeredBy = asString(r.triggeredBy);
    const startedAt = asString(r.startedAt);
    const finishedAt = asString(r.finishedAt);
    if (!id || !status || !pipelineId || !branch || !commitSha || !triggeredBy) continue;
    items.push({ id, status, pipelineId, branch, commitSha, triggeredBy, startedAt, finishedAt });
  }

  return { items, total };
}

/**
 * Lists recent runs with pagination; polls the API on an interval once endpoints are live.
 */
export default function RunsList(): ReactElement {
  const [page, setPage] = useState(1);
  const { state, refresh } = useRuns(page);

  useEffect(() => {
    const id = window.setInterval(() => {
      refresh();
    }, 10_000);
    return () => {
      window.clearInterval(id);
    };
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Runs</h2>
          <p className="text-sm text-slate-400">History of pipeline executions</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          onClick={() => {
            refresh();
          }}
        >
          Refresh
        </button>
      </div>

      {state.status === "loading" || state.status === "idle" ? (
        <p className="text-sm text-slate-400">Loading runs…</p>
      ) : null}

      {state.status === "error" ? (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">
          <p className="font-medium">Could not load runs</p>
          <p className="text-amber-200/80">{state.message}</p>
          <p className="mt-2 text-xs text-amber-200/60">
            Ensure the API is running and <code className="rounded bg-black/30 px-1">GET /api/runs</code> is
            implemented.
          </p>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pipeline</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Commit</th>
                <th className="px-4 py-3">Triggered by</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {(() => {
                const parsed = parseRunsList(state.data);
                if (parsed === null) {
                  return (
                    <tr>
                      <td className="px-4 py-6 text-slate-300" colSpan={7}>
                        <div className="flex flex-col gap-2">
                          <p>Unexpected API response shape.</p>
                          <pre className="max-h-48 overflow-auto rounded-md bg-black/50 p-3 text-xs text-slate-200">
                            {JSON.stringify(state.data, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (parsed.items.length === 0) {
                  return (
                    <tr>
                      <td className="px-4 py-6 text-slate-400" colSpan={7}>
                        No runs yet. Push a commit to a repo with the webhook configured to create the first run.
                      </td>
                    </tr>
                  );
                }

                return parsed.items.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link className="text-blue-300 hover:underline" to={`/runs/${run.id}`}>
                        {run.pipelineId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">{run.branch}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">{run.commitSha.slice(0, 7)}</td>
                    <td className="px-4 py-3 text-slate-300">{run.triggeredBy}</td>
                    <td className="px-4 py-3 text-slate-400">{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDurationMs(run.startedAt, run.finishedAt)}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-sm text-slate-400">
        <button
          type="button"
          className="rounded-md border border-slate-800 px-3 py-1 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => {
            setPage((p) => Math.max(1, p - 1));
          }}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          type="button"
          className="rounded-md border border-slate-800 px-3 py-1"
          onClick={() => {
            setPage((p) => p + 1);
          }}
        >
          Next
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Tip: open a specific run at <Link className="text-blue-400 hover:underline" to="/runs/demo">/runs/demo</Link>{" "}
        (placeholder id).
      </p>
    </div>
  );
}
