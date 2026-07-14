import type { PipelineDTO } from "../../../../../domain/index.js";
import type { PipelineDocument } from "../../../../../models/Pipeline.js";

export class PipelineMapper {
  static toDTO(doc: PipelineDocument): PipelineDTO {
    return {
      pipelineId: doc.pipelineId,
      refSha: doc.refSha,
      rawYaml: doc.rawYaml,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    };
  }
}
