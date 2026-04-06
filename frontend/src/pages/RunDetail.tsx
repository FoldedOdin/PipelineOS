import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LogViewer from "../components/LogViewer";
import StageRow from "../components/StageRow";
import { apiGetJson } from "../api/client";

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
        <Link
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          to={`/runs/${id ?? ""}/logs`}
        >
          View live logs
        </Link>
      </div>

      {error !== undefined ? (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">
          <p className="font-medium">Could not load run</p>
          <p className="text-amber-200/80">{error}</p>
        </div>
      ) : null}

      {payload !== undefined ? (
        <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-black/40 p-4 text-xs text-slate-200">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Stages (sample layout)</h3>
        <StageRow name="install" status="success" image="node:20-alpine" durationLabel="12s">
          <LogViewer text={"npm ci\nadded 120 packages\n"} />
        </StageRow>
      </div>
    </div>
  );
}
