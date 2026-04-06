import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import LogViewer from "../components/LogViewer";
import { useLogStream } from "../hooks/useLogStream";

/**
 * Subscribes to the WebSocket log stream for an active run and renders rolling output.
 */
export default function LiveLogs(): ReactElement {
  const { id } = useParams();
  const { state, reconnect } = useLogStream(id);

  const text =
    state.status === "open"
      ? state.lines.map((l) => `[${l.timestamp}] ${l.stageName}: ${l.line}`).join("\n")
      : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Live logs</h2>
          <p className="text-sm text-slate-400">Run id: {id ?? "unknown"}</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          onClick={() => {
            reconnect();
          }}
        >
          Reconnect
        </button>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
        <p>
          Status: <span className="font-mono text-white">{state.status}</span>
        </p>
        {state.status === "error" ? <p className="text-amber-200">{state.message}</p> : null}
        {state.status === "closed" ? <p className="text-slate-400">{state.reason}</p> : null}
      </div>

      <LogViewer text={text.length > 0 ? text : "Waiting for log lines…"} />
    </div>
  );
}
