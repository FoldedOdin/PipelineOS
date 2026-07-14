export interface RunnerRegistrationDTO {
  id: string;
  runnerId: string;
  lastHeartbeatAt: Date;
  status: "online" | "offline";
  version?: string;
  hostname?: string;
  platform?: string;
  activeRuns?: number;
  maxConcurrentRuns?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RegisterOrHeartbeatInput {
  runnerId: string;
  lastHeartbeatAt: Date;
  status?: "online" | "offline";
  version?: string;
  hostname?: string;
  platform?: string;
  activeRuns?: number;
  maxConcurrentRuns?: number;
}
