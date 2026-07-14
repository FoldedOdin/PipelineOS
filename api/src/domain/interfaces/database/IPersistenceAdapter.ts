import type { IRunRepository } from "./IRunRepository.js";
import type { IStageRepository } from "./IStageRepository.js";
import type { IPipelineRepository } from "./IPipelineRepository.js";
import type { IRemediationRuleRepository } from "./IRemediationRuleRepository.js";
import type { IRunnerRegistrationRepository } from "./IRunnerRegistrationRepository.js";
import type { IStageFlakinessRepository } from "./IStageFlakinessRepository.js";
import type { IWebhookDeliveryRepository } from "./IWebhookDeliveryRepository.js";
import type { IArtifactRepository } from "./IArtifactRepository.js";

export interface IPersistenceAdapter {
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
  healthCheck(): Promise<boolean>;
}
