import mongoose from "mongoose";
import type {
  IStageFlakinessRepository,
  StageFlakinessRecordDTO,
  RecordStageOutcomeInput,
} from "../../../../../domain/index.js";
import {
  StageFlakinessRecord,
  type StageFlakinessRecordDocument,
} from "../../../../../models/StageFlakinessRecord.js";
import { StageFlakinessMapper } from "../mappers/index.js";

const MAX_OUTCOMES_PER_STAGE = 50;

export class MongoStageFlakinessRepository implements IStageFlakinessRepository {
  async recordStageOutcome(input: RecordStageOutcomeInput): Promise<void> {
    const runId = mongoose.isValidObjectId(input.runId)
      ? new mongoose.Types.ObjectId(input.runId)
      : input.runId;

    await StageFlakinessRecord.findOneAndUpdate(
      { pipelineId: input.pipelineId, stageName: input.stageName },
      {
        $push: {
          outcomes: {
            $each: [
              {
                runId: runId as unknown as mongoose.Types.ObjectId,
                success: input.success,
                at: input.at,
              },
            ],
            $slice: -MAX_OUTCOMES_PER_STAGE,
          },
        },
      },
      { upsert: true, new: true },
    ).exec();
  }

  async findTopFlaky(limit = 50): Promise<StageFlakinessRecordDTO[]> {
    const docs = await StageFlakinessRecord.find().sort({ updatedAt: -1 }).limit(limit).exec();
    return docs.map((d: unknown) => StageFlakinessMapper.toDTO(d as StageFlakinessRecordDocument));
  }

  async findByPipelineAndStage(
    pipelineId: string,
    stageName: string,
  ): Promise<StageFlakinessRecordDTO | null> {
    const doc = await StageFlakinessRecord.findOne({ pipelineId, stageName }).exec();
    return doc ? StageFlakinessMapper.toDTO(doc as unknown as StageFlakinessRecordDocument) : null;
  }

  async findByPipeline(pipelineId: string): Promise<StageFlakinessRecordDTO[]> {
    const docs = await StageFlakinessRecord.find({ pipelineId }).sort({ stageName: 1 }).exec();
    return docs.map((d: unknown) => StageFlakinessMapper.toDTO(d as StageFlakinessRecordDocument));
  }

  async deleteAll(): Promise<void> {
    await StageFlakinessRecord.deleteMany({}).exec();
  }
}
