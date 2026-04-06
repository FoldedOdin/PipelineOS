import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRuns } from "../hooks/useRuns";

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
              <tr>
                <td className="px-4 py-6 text-slate-300" colSpan={7}>
                  <div className="flex flex-col gap-2">
                    <p>
                      API responded; wire this table once <code className="rounded bg-black/40 px-1">runs</code>{" "}
                      payloads are stable.
                    </p>
                    <pre className="max-h-48 overflow-auto rounded-md bg-black/50 p-3 text-xs text-slate-200">
                      {JSON.stringify(state.data, null, 2)}
                    </pre>
                  </div>
                </td>
              </tr>
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
