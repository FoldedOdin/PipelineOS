import path from "node:path";
import fs from "node:fs/promises";


export class BaseLocalFileSystemStorage {
  protected basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Initializes the base storage directory.
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  /**
   * Constructs the absolute path for a pipeline/run/stage asset.
   * e.g. /data/logs/pipelineId/runId/stageName.log
   * or /data/artifacts/pipelineId/runId/stageName/fileName
   */
  protected getPath(pipelineId: string, runId: string, stageName: string, fileName: string): string {
    return path.join(this.basePath, pipelineId, runId, stageName, fileName);
  }

  /**
   * Ensures the directory exists for a given file path.
   */
  protected async ensureDirectoryForFile(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }
}
