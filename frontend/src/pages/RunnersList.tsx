import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { apiGetJson } from "../api/client";

interface RunnerRegistration {
  _id: string;
  runnerId: string;
  lastHeartbeatAt: string;
  status: "online" | "offline";
  version?: string;
  hostname?: string;
  platform?: string;
  isStale?: boolean;
  activeRuns?: number;
  maxConcurrentRuns?: number;
}

export default function RunnersList(): ReactElement {
  const [runners, setRunners] = useState<RunnerRegistration[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchRunners() {
      try {
        const res = await apiGetJson("/api/runners");
        if (!active) return;
        const data = res as { runners: RunnerRegistration[] };
        setRunners(data.runners);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "failed to fetch runners");
      }
    }

    void fetchRunners();
    const interval = setInterval(() => {
      void fetchRunners();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">Runners</h2>
        <p className="text-slate-400">Manage active pipeline execution environments.</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-500/10 p-4 text-red-400 border border-red-500/20">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-900/50">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Runner ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Load</th>
              <th className="px-4 py-3">Last Heartbeat</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Host</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {runners.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No runners registered. Start a runner to see it here.
                </td>
              </tr>
            ) : (
              runners.map((r) => {
                const heartbeat = new Date(r.lastHeartbeatAt);
                
                // If the server marked it as stale, treat it as offline in the UI regardless of DB status.
                const displayStatus = r.isStale ? "offline" : r.status;

                return (
                  <tr key={r._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200">{r.runnerId}</td>
                    <td className="px-4 py-3">
                      {displayStatus === "online" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Offline
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.maxConcurrentRuns ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${String(Math.min(100, Math.max(0, ((r.activeRuns ?? 0) / r.maxConcurrentRuns) * 100)))}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">
                            {r.activeRuns ?? 0} / {r.maxConcurrentRuns}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{heartbeat.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400">{r.version ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {r.hostname ? (
                        <span className="flex items-center gap-1">
                          {r.hostname}
                          {r.platform && <span className="text-xs">({r.platform})</span>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
