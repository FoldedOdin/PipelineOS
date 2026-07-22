import type { Readable } from "node:stream";
import { S3Client, GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { IArtifactStorageAdapter } from "../../../../domain/interfaces/storage/IArtifactStorageAdapter.js";

export class S3ArtifactStorageAdapter implements IArtifactStorageAdapter {
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

  private getKey(pipelineId: string, runId: string, stageName: string, fileName: string): string {
    return `${this.prefix}/data/artifacts/${pipelineId}/${runId}/${stageName}/${fileName}`;
  }

  async uploadArtifact(
    pipelineId: string,
    runId: string,
    stageName: string,
    fileName: string,
    stream: Readable
  ): Promise<void> {
    const key = this.getKey(pipelineId, runId, stageName, fileName);

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream,
      },
    });

    await upload.done();
  }

  async getArtifactStream(
    pipelineId: string,
    runId: string,
    stageName: string,
    fileName: string
  ): Promise<Readable> {
    const key = this.getKey(pipelineId, runId, stageName, fileName);

    try {
      const getResponse = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!getResponse.Body) {
        throw new Error("No body in response");
      }
      return getResponse.Body as Readable;
    } catch (err) {
      if (err instanceof NoSuchKey || (err as any).name === "NoSuchKey") {
        throw new Error("not_found");
      }
      throw err;
    }
  }
}
