import { createWriteStream, createReadStream } from "node:fs";
import fs from "node:fs/promises";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { BaseLocalFileSystemStorage } from "./BaseLocalFileSystemStorage.js";
import type { IArtifactStorageAdapter } from "../../../../domain/interfaces/storage/IArtifactStorageAdapter.js";

export class LocalArtifactStorageAdapter extends BaseLocalFileSystemStorage implements IArtifactStorageAdapter {
  constructor(basePath: string) {
    super(basePath);
  }

  async uploadArtifact(
    pipelineId: string,
    runId: string,
    stageName: string,
    fileName: string,
    stream: Readable
  ): Promise<void> {
    const filePath = this.getPath(pipelineId, runId, stageName, fileName);
    await this.ensureDirectoryForFile(filePath);
    
    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);
  }

  async getArtifactStream(
    pipelineId: string,
    runId: string,
    stageName: string,
    fileName: string
  ): Promise<Readable> {
    const filePath = this.getPath(pipelineId, runId, stageName, fileName);
    
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Artifact not found: ${filePath}`);
    }

    return createReadStream(filePath);
  }
}
