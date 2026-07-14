import type { ArtifactDTO, CreateArtifactInput } from "../../dto/index.js";

export interface IArtifactRepository {
  create(input: CreateArtifactInput): Promise<ArtifactDTO>;
  findByRunId(runId: string): Promise<ArtifactDTO[]>;
  findById(id: string): Promise<ArtifactDTO | null>;
  delete(id: string): Promise<boolean>;
  deleteAll(): Promise<void>;
}
