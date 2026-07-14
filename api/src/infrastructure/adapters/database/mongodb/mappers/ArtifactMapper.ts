import type { ArtifactDTO } from "../../../../../domain/index.js";
import type { IArtifactDocument } from "../../../../../models/Artifact.js";

export class ArtifactMapper {
  static toDTO(doc: IArtifactDocument): ArtifactDTO {
    const docAny = doc as unknown as { _id?: { toString(): string }; createdAt?: Date };
    return {
      id: docAny._id?.toString() ?? `${doc.runId}_${doc.name}`,
      runId: doc.runId,
      stageName: doc.stageName,
      name: doc.name,
      sizeBytes: doc.sizeBytes,
      contentType: doc.contentType,
      storagePath: doc.storagePath,
      createdAt: docAny.createdAt ? new Date(docAny.createdAt) : new Date(),
    };
  }
}
