import type { RunnerRegistrationDTO, RegisterOrHeartbeatInput } from "../../dto/index.js";

export interface IRunnerRegistrationRepository {
  findByRunnerId(runnerId: string): Promise<RunnerRegistrationDTO | null>;
  findAll(): Promise<RunnerRegistrationDTO[]>;
  registerOrHeartbeat(input: RegisterOrHeartbeatInput): Promise<RunnerRegistrationDTO>;
  delete(runnerId: string): Promise<boolean>;
  deleteAll(): Promise<void>;
}
