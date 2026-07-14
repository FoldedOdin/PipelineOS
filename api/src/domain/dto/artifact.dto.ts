export interface ArtifactDTO {
  id: string;
  runId: string;
  stageName: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  storagePath: string;
  createdAt: Date;
}

export interface CreateArtifactInput {
  runId: string;
  stageName: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  storagePath: string;
}
