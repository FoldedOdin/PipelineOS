import type { ReactElement, ReactNode } from "react";
import StatusBadge from "./StatusBadge";

export interface StageRowProps {
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  image: string;
  durationLabel: string;
  children?: ReactNode;
}

/**
 * Presents a single pipeline stage with optional expandable body (logs).
 */
export default function StageRow({
  name,
  status,
  image,
  durationLabel,
  children,
}: StageRowProps): ReactElement {
  const mapped =
    status === "pending"
      ? "queued"
      : status === "running"
        ? "running"
        : status === "success"
          ? "success"
          : status === "failed"
            ? "failed"
            : "cancelled";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-slate-400">{image}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{durationLabel}</span>
          <StatusBadge status={mapped} />
        </div>
      </div>
      {children !== undefined ? <div className="mt-3 border-t border-slate-800 pt-3">{children}</div> : null}
    </div>
  );
}
