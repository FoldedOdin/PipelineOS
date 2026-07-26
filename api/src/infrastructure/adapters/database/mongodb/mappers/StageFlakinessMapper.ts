import type { StageFlakinessRecordDTO } from "../../../../../domain/index.js";
import type { StageFlakinessRecordDocument } from "../../../../../models/StageFlakinessRecord.js";

export class StageFlakinessMapper {
  static toDTO(doc: StageFlakinessRecordDocument): StageFlakinessRecordDTO {
    const docAny = doc as unknown as {
      _id?: { toString(): string };
      createdAt?: Date;
      updatedAt?: Date;
    };
    return {
      id: docAny._id?.toString() ?? `${doc.pipelineId}_${doc.stageName}`,
      pipelineId: doc.pipelineId,
      stageName: doc.stageName,
      outcomes: (doc.outcomes ?? []).map((o) => ({
        runId: o.runId.toString(),
        success: o.success,
        at: new Date(o.at),
      })),
      createdAt: docAny.createdAt ? new Date(docAny.createdAt) : new Date(),
      updatedAt: docAny.updatedAt ? new Date(docAny.updatedAt) : new Date(),
    };
  }
}
