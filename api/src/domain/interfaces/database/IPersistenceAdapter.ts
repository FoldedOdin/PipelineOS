import type { IRunRepository } from "./IRunRepository.js";
import type { IStageRepository } from "./IStageRepository.js";
import type { IPipelineRepository } from "./IPipelineRepository.js";
import type { IRemediationRuleRepository } from "./IRemediationRuleRepository.js";
import type { IRunnerRegistrationRepository } from "./IRunnerRegistrationRepository.js";
import type { IStageFlakinessRepository } from "./IStageFlakinessRepository.js";
import type { IWebhookDeliveryRepository } from "./IWebhookDeliveryRepository.js";
import type { IArtifactRepository } from "./IArtifactRepository.js";

export interface PersistenceCapabilities {
  readonly supportsTransactions: boolean;
  readonly supportsJson: boolean;
  readonly supportsFullTextSearch: boolean;
  readonly supportsConcurrentLocks: boolean;
}

export interface DatabaseHealthInfo {
  readonly connected: boolean;
  readonly provider: "sqlite" | "mongodb" | "postgresql";
  readonly database: string;
  readonly version?: string;
  readonly migrationVersion?: number;
  readonly wal?: boolean;
  readonly details?: Record<string, unknown>;
}

export interface IPersistenceAdapter {
  readonly capabilities: PersistenceCapabilities;
  readonly runRepository: IRunRepository;
  readonly stageRepository: IStageRepository;
  readonly pipelineRepository: IPipelineRepository;
  readonly remediationRuleRepository: IRemediationRuleRepository;
  readonly runnerRegistrationRepository: IRunnerRegistrationRepository;
  readonly stageFlakinessRepository: IStageFlakinessRepository;
  readonly webhookDeliveryRepository: IWebhookDeliveryRepository;
  readonly artifactRepository: IArtifactRepository;

  connect(logger?: unknown): Promise<void>;
  disconnect(): Promise<void>;
  migrate(): Promise<void>;
  healthCheck(): Promise<DatabaseHealthInfo>;
}
