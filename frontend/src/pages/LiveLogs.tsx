import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import LogViewer from "../components/LogViewer";
import type { LogLine } from "../hooks/useLogStream";
import { useLogStream } from "../hooks/useLogStream";
import { filterLogLines, formatLogLines } from "./liveLogsHelpers";

/**
 * Subscribes to the WebSocket log stream for an active run and renders rolling output.
 */
export default function LiveLogs(): ReactElement {
  const { id } = useParams();
  const { state, reconnect } = useLogStream(id);
  const [query, setQuery] = useState("");
  const [pausedLines, setPausedLines] = useState<LogLine[] | null>(null);

  const liveLines = state.status === "open" ? state.lines : [];
  const displayLines = pausedLines ?? liveLines;
  const filteredLines = useMemo(() => filterLogLines(displayLines, query), [displayLines, query]);
  const text = formatLogLines(filteredLines);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Live logs</h2>
          <p className="text-sm text-slate-400">Run id: {id ?? "unknown"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            onClick={() => {
              if (pausedLines === null) {
                setPausedLines(liveLines);
              } else {
                setPausedLines(null);
              }
            }}
          >
            {pausedLines === null ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            onClick={() => {
              setPausedLines(null);
              reconnect();
            }}
          >
            Reconnect
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Status: <span className="font-mono text-white">{state.status}</span>
            {pausedLines !== null ? <span className="ml-2 text-amber-300">paused view</span> : null}
          </p>
          <p className="font-mono text-xs text-slate-500">
            showing {String(filteredLines.length)} / {String(displayLines.length)}
          </p>
        </div>
        {state.status === "error" ? <p className="text-amber-200">{state.message}</p> : null}
        {state.status === "closed" ? <p className="text-slate-400">{state.reason}</p> : null}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="logSearch">
          Search logs
        </label>
        <input
          id="logSearch"
          className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white"
          placeholder="stage name, error text, package name..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>

      <LogViewer text={text.length > 0 ? text : "Waiting for log lines…"} />
    </div>
  );
}
