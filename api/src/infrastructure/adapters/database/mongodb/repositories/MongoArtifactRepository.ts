import { isValidObjectId } from "mongoose";
import type {
  IArtifactRepository,
  ArtifactDTO,
  CreateArtifactInput,
} from "../../../../../domain/index.js";
import { Artifact, type IArtifactDocument } from "../../../../../models/Artifact.js";
import { ArtifactMapper } from "../mappers/index.js";

export class MongoArtifactRepository implements IArtifactRepository {
  async create(input: CreateArtifactInput): Promise<ArtifactDTO> {
    const doc = await Artifact.create({
      runId: input.runId,
      stageName: input.stageName,
      name: input.name,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      storagePath: input.storagePath,
    });
    return ArtifactMapper.toDTO(doc as unknown as IArtifactDocument);
  }

  async findByRunId(runId: string): Promise<ArtifactDTO[]> {
    const docs = await Artifact.find({ runId }).sort({ createdAt: -1 }).exec();
    return docs.map((d: unknown) => ArtifactMapper.toDTO(d as IArtifactDocument));
  }

  async findById(id: string): Promise<ArtifactDTO | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await Artifact.findById(id).exec();
    return doc ? ArtifactMapper.toDTO(doc as unknown as IArtifactDocument) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const res = await Artifact.deleteOne({ _id: id }).exec();
    return res.deletedCount > 0;
  }

  async deleteAll(): Promise<void> {
    await Artifact.deleteMany({}).exec();
  }
}
