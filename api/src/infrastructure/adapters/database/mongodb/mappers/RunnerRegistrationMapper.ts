import type { RunnerRegistrationDTO } from "../../../../../domain/index.js";
import type { IRunnerRegistration } from "../../../../../models/RunnerRegistration.js";

export class RunnerRegistrationMapper {
  static toDTO(doc: IRunnerRegistration): RunnerRegistrationDTO {
    const docAny = doc as unknown as {
      _id?: { toString(): string };
      createdAt?: Date;
      updatedAt?: Date;
    };
    return {
      id: docAny._id?.toString() ?? doc.runnerId,
      runnerId: doc.runnerId,
      lastHeartbeatAt: new Date(doc.lastHeartbeatAt),
      status: doc.status,
      version: doc.version,
      hostname: doc.hostname,
      platform: doc.platform,
      activeRuns: doc.activeRuns,
      maxConcurrentRuns: doc.maxConcurrentRuns,
      createdAt: docAny.createdAt ? new Date(docAny.createdAt) : undefined,
      updatedAt: docAny.updatedAt ? new Date(docAny.updatedAt) : undefined,
    };
  }
}
