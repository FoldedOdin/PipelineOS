import type { Readable } from "node:stream";

export interface LogRangeQuery {
  start?: number;
  end?: number;
}

export interface ILogStorageAdapter {
  /**
   * Appends a chunk of log output to the storage backend.
   */
  appendLog(pipelineId: string, runId: string, stageName: string, chunk: string): Promise<void>;

  /**
   * Retrieves logs as a readable stream.
   * Can optionally limit to a byte range (e.g. for streaming to UI).
   */
  getLogsStream(
    pipelineId: string,
    runId: string,
    stageName: string,
    range?: LogRangeQuery,
  ): Promise<Readable>;
}
