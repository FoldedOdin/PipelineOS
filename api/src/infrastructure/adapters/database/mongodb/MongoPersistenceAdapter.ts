import mongoose from "mongoose";
import type {
  IPersistenceAdapter,
  IRunRepository,
  IStageRepository,
  IPipelineRepository,
  IRemediationRuleRepository,
  IRunnerRegistrationRepository,
  IStageFlakinessRepository,
  IWebhookDeliveryRepository,
  IArtifactRepository,
} from "../../../../domain/index.js";
import {
  MongoRunRepository,
  MongoStageRepository,
  MongoPipelineRepository,
  MongoRemediationRuleRepository,
  MongoRunnerRegistrationRepository,
  MongoStageFlakinessRepository,
  MongoWebhookDeliveryRepository,
  MongoArtifactRepository,
} from "./repositories/index.js";
import "../../../../models/Pipeline.js";
import "../../../../models/RemediationRule.js";
import "../../../../models/Run.js";
import "../../../../models/RunnerRegistration.js";
import "../../../../models/StageFlakinessRecord.js";
import "../../../../models/WebhookDelivery.js";
import "../../../../models/Artifact.js";

export class MongoPersistenceAdapter implements IPersistenceAdapter {
  readonly runRepository: IRunRepository = new MongoRunRepository();
  readonly stageRepository: IStageRepository = new MongoStageRepository();
  readonly pipelineRepository: IPipelineRepository = new MongoPipelineRepository();
  readonly remediationRuleRepository: IRemediationRuleRepository = new MongoRemediationRuleRepository();
  readonly runnerRegistrationRepository: IRunnerRegistrationRepository = new MongoRunnerRegistrationRepository();
  readonly stageFlakinessRepository: IStageFlakinessRepository = new MongoStageFlakinessRepository();
  readonly webhookDeliveryRepository: IWebhookDeliveryRepository = new MongoWebhookDeliveryRepository();
  readonly artifactRepository: IArtifactRepository = new MongoArtifactRepository();

  async connect(logger?: unknown): Promise<void> {
    const uri = process.env.MONGODB_URI;
    if (uri === undefined || uri === "") {
      throw new Error("MONGODB_URI is required");
    }
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri);
    if (logger && typeof logger === "object" && "info" in logger && typeof (logger as { info: unknown }).info === "function") {
      (logger as { info: (msg: string) => void }).info("connected to MongoDB");
    }
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect();
  }

  async healthCheck(): Promise<boolean> {
    try {
      if ((mongoose.connection.readyState as unknown as number) === 1) {
        await mongoose.connection.db?.command({ ping: 1 });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
