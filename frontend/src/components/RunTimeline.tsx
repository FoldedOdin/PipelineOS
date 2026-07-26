import type { ReactElement } from "react";
import StatusBadge from "./StatusBadge";

type StageStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface TimelineStage {
  name: string;
  status: StageStatus;
  durationLabel: string;
}

const nodeStyles: Record<StageStatus, string> = {
  pending: "border-slate-700 bg-slate-950 text-slate-400",
  running: "border-blue-400 bg-blue-950 text-blue-100",
  success: "border-emerald-400 bg-emerald-950 text-emerald-100",
  failed: "border-rose-400 bg-rose-950 text-rose-100",
  skipped: "border-amber-400 bg-amber-950 text-amber-100",
};

function mapStageStatus(
  status: StageStatus,
): "queued" | "running" | "success" | "failed" | "cancelled" {
  if (status === "pending") return "queued";
  if (status === "skipped") return "cancelled";
  return status;
}

export default function RunTimeline({ stages }: { stages: TimelineStage[] }): ReactElement | null {
  if (stages.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-200">Run timeline</h3>
        <span className="text-xs text-slate-500">{String(stages.length)} stages</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-max items-stretch gap-3">
          {stages.map((stage, index) => (
            <li key={stage.name} className="flex items-center gap-3">
              <div className={`w-44 rounded-md border p-3 ${nodeStyles[stage.status]}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs">{stage.name}</span>
                  <StatusBadge status={mapStageStatus(stage.status)} />
                </div>
                <p className="font-mono text-xs opacity-80">{stage.durationLabel}</p>
              </div>
              {index < stages.length - 1 ? (
                <div className="h-px w-8 bg-slate-700" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
