import { useCallback, useEffect, useState } from "react";
import { apiGetJson } from "../api/client";

export type RunsListState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: unknown };

/**
 * Fetches paginated runs from `GET /api/runs` on mount and when `refresh` is called.
 */
export function useRuns(page: number): { state: RunsListState; refresh: () => void } {
  const [state, setState] = useState<RunsListState>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const query = new URLSearchParams({ page: String(page), limit: "20" });
      const data = await apiGetJson(`/api/runs?${query.toString()}`);
      setState({ status: "ready", data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      setState({ status: "error", message });
    }
  }, [page]);

  const refresh = useCallback(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, refresh };
}
