import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import fs from "node:fs/promises";
import { BaseLocalFileSystemStorage } from "./BaseLocalFileSystemStorage.js";
import type { ILogStorageAdapter, LogRangeQuery } from "../../../../domain/interfaces/storage/ILogStorageAdapter.js";

export class LocalLogStorageAdapter extends BaseLocalFileSystemStorage implements ILogStorageAdapter {
  constructor(basePath: string) {
    super(basePath);
  }

  async appendLog(pipelineId: string, runId: string, stageName: string, chunk: string): Promise<void> {
    const filePath = this.getPath(pipelineId, runId, stageName, "stage.log");
    await this.ensureDirectoryForFile(filePath);
    await fs.appendFile(filePath, chunk, "utf-8");
  }

  async getLogsStream(pipelineId: string, runId: string, stageName: string, range?: LogRangeQuery): Promise<Readable> {
    const filePath = this.getPath(pipelineId, runId, stageName, "stage.log");
    
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Log file not found: ${filePath}`);
    }

    const options: any = { encoding: "utf-8" };
    if (range) {
      if (range.start !== undefined) options.start = range.start;
      if (range.end !== undefined) options.end = range.end;
    }

    return createReadStream(filePath, options);
  }
}
