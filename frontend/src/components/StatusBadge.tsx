import type { ReactElement } from "react";

type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";

const styles: Record<RunStatus, string> = {
  queued: "bg-slate-700 text-slate-100",
  running: "bg-blue-600 text-white animate-pulse",
  success: "bg-emerald-600 text-white",
  failed: "bg-red-600 text-white",
  cancelled: "bg-amber-600 text-white",
};

export interface StatusBadgeProps {
  status: RunStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps): ReactElement {
  const className = styles[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}
