import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { apiGetJson } from "../api/client";

type StageStatus = "pending" | "running" | "success" | "failed" | "skipped";

interface DiagnosisPayload {
  summary: string;
  hints: string[];
  llmUsed: boolean;
  patterns: string[];
}

function parseDiagnosis(payload: unknown): DiagnosisPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const o = payload as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary : null;
  const llmUsed = o.llmUsed === true;
  if (summary === null) return null;
  const hints = Array.isArray(o.hints) ? o.hints.filter((h): h is string => typeof h === "string") : [];
  const patterns = Array.isArray(o.patterns) ? o.patterns.filter((p): p is string => typeof p === "string") : [];
  return { summary, hints, llmUsed, patterns };
}

export interface DiagnosisCardProps {
  runId: string;
  stageName: string;
  status: StageStatus;
}

export default function DiagnosisCard(props: DiagnosisCardProps): ReactElement {
  const { runId, stageName, status } = props;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [data, setData] = useState<DiagnosisPayload | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const path = `/api/runs/${runId}/stages/${encodeURIComponent(stageName)}/diagnosis`;
      const raw = await apiGetJson(path);
      const parsed = parseDiagnosis(raw);
      if (parsed === null) {
        setError("Unexpected response");
        return;
      }
      setData(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }, [runId, stageName]);

  const handleToggle = (): void => {
    if (!open) {
      setOpen(true);
      void load();
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/60">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-900/80"
        onClick={handleToggle}
      >
        <span>
          Diagnosis
          {status === "failed" ? <span className="ml-2 text-rose-400">(failed)</span> : null}
        </span>
        <span className="text-slate-500">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-800 px-3 py-3 text-sm text-slate-200">
          {loading ? <p className="text-slate-400">Loading…</p> : null}
          {error !== undefined ? <p className="text-amber-200">{error}</p> : null}
          {data !== undefined && !loading ? (
            <div className="space-y-2">
              <p className="text-slate-100">{data.summary}</p>
              {data.llmUsed ? <p className="text-xs text-emerald-400">LLM summary enabled</p> : null}
              {data.patterns.length > 0 ? (
                <p className="text-xs text-slate-500">
                  Patterns: {data.patterns.join(", ")}
                </p>
              ) : null}
              {data.hints.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Likely error lines</p>
                  <ul className="max-h-64 overflow-auto rounded border border-slate-800 bg-black/40 font-mono text-xs text-slate-300">
                    {data.hints.map((h, idx) => (
                      <li key={`${String(idx)}-${h.slice(0, 40)}`} className="border-b border-slate-900/80 px-2 py-1 last:border-b-0">
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <button
                type="button"
                className="text-xs text-blue-400 hover:text-blue-300"
                onClick={() => {
                  void load();
                }}
              >
                Refresh
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
