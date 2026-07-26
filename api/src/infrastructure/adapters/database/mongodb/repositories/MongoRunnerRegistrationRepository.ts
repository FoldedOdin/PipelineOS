import type {
  IRunnerRegistrationRepository,
  RunnerRegistrationDTO,
  RegisterOrHeartbeatInput,
} from "../../../../../domain/index.js";
import {
  RunnerRegistration,
  type IRunnerRegistration,
} from "../../../../../models/RunnerRegistration.js";
import { RunnerRegistrationMapper } from "../mappers/index.js";

export class MongoRunnerRegistrationRepository implements IRunnerRegistrationRepository {
  async findByRunnerId(runnerId: string): Promise<RunnerRegistrationDTO | null> {
    const doc = await RunnerRegistration.findOne({ runnerId }).exec();
    return doc ? RunnerRegistrationMapper.toDTO(doc as unknown as IRunnerRegistration) : null;
  }

  async findAll(): Promise<RunnerRegistrationDTO[]> {
    const docs = await RunnerRegistration.find().exec();
    return docs.map((d: unknown) => RunnerRegistrationMapper.toDTO(d as IRunnerRegistration));
  }

  async registerOrHeartbeat(input: RegisterOrHeartbeatInput): Promise<RunnerRegistrationDTO> {
    const doc = await RunnerRegistration.findOneAndUpdate(
      { runnerId: input.runnerId },
      {
        $set: {
          runnerId: input.runnerId,
          lastHeartbeatAt: input.lastHeartbeatAt,
          status: input.status ?? "online",
          version: input.version,
          hostname: input.hostname,
          platform: input.platform,
          activeRuns: input.activeRuns,
          maxConcurrentRuns: input.maxConcurrentRuns,
        },
      },
      { upsert: true, new: true },
    ).exec();
    return RunnerRegistrationMapper.toDTO(doc as unknown as IRunnerRegistration);
  }

  async delete(runnerId: string): Promise<boolean> {
    const res = await RunnerRegistration.deleteOne({ runnerId }).exec();
    return res.deletedCount > 0;
  }

  async deleteAll(): Promise<void> {
    await RunnerRegistration.deleteMany({}).exec();
  }
}
