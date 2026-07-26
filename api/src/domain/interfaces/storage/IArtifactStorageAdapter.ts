import type { Readable } from "node:stream";

export interface IArtifactStorageAdapter {
  /**
   * Uploads an artifact from a readable stream to the storage backend.
   */
  uploadArtifact(
    pipelineId: string,
    runId: string,
    stageName: string,
    fileName: string,
    stream: Readable,
  ): Promise<void>;

  /**
   * Retrieves an artifact as a readable stream.
   */
  getArtifactStream(
    pipelineId: string,
    runId: string,
    stageName: string,
    fileName: string,
  ): Promise<Readable>;
}
