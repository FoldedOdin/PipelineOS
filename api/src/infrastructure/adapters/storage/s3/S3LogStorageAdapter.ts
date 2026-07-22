import type { Readable } from "node:stream";
import { S3Client, GetObjectCommand, PutObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import type { ILogStorageAdapter, LogRangeQuery } from "../../../../domain/interfaces/storage/ILogStorageAdapter.js";

export class S3LogStorageAdapter implements ILogStorageAdapter {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(
    region: string,
    bucket: string,
    prefix: string = "pipelineos",
    endpoint?: string,
    credentials?: { accessKeyId: string; secretAccessKey: string },
    forcePathStyle: boolean = false
  ) {
    this.bucket = bucket;
    this.prefix = prefix;
    this.client = new S3Client({
      region,
      endpoint,
      credentials,
      forcePathStyle,
    });
  }

  private getKey(pipelineId: string, runId: string, stageName: string): string {
    return `${this.prefix}/data/logs/${pipelineId}/${runId}/${stageName}/stage.log`;
  }

  async appendLog(pipelineId: string, runId: string, stageName: string, chunk: string): Promise<void> {
    const key = this.getKey(pipelineId, runId, stageName);

    let existingLogs = "";
    try {
      const getResponse = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (getResponse.Body) {
        existingLogs = await getResponse.Body.transformToString("utf-8");
      }
    } catch (err) {
      if (err instanceof NoSuchKey || (err as any).name === "NoSuchKey") {
        // file doesn't exist yet, which is fine
      } else {
        throw err;
      }
    }

    const newLogs = existingLogs + chunk;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: newLogs,
        ContentType: "text/plain",
      })
    );
  }

  async getLogsStream(
    pipelineId: string,
    runId: string,
    stageName: string,
    range?: LogRangeQuery
  ): Promise<Readable> {
    const key = this.getKey(pipelineId, runId, stageName);

    let Range: string | undefined;
    if (range && (range.start !== undefined || range.end !== undefined)) {
      const start = range.start ?? 0;
      const end = range.end !== undefined ? String(range.end) : "";
      Range = `bytes=${start}-${end}`;
    }

    try {
      const getResponse = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key, Range })
      );
      
      if (!getResponse.Body) {
        throw new Error("No body in response");
      }
      
      // S3 SDK's Body is a stream-like object in Node (SdkStream<Readable>)
      return getResponse.Body as Readable;
    } catch (err) {
      if (err instanceof NoSuchKey || (err as any).name === "NoSuchKey") {
        // Return empty stream if no logs exist
        const { Readable } = await import("node:stream");
        return Readable.from([]);
      }
      throw err;
    }
  }
}
