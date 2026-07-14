import type {
  IWebhookDeliveryRepository,
  RecordWebhookDeliveryInput,
} from "../../../../../domain/index.js";
import { WebhookDelivery } from "../../../../../models/WebhookDelivery.js";

export class MongoWebhookDeliveryRepository implements IWebhookDeliveryRepository {
  async recordDelivery(input: RecordWebhookDeliveryInput): Promise<boolean> {
    try {
      await WebhookDelivery.create({
        deliveryId: input.deliveryId,
        event: input.event,
        pipelineId: input.pipelineId,
      });
      return true;
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
        return false;
      }
      throw err;
    }
  }

  async deleteAll(): Promise<void> {
    await WebhookDelivery.deleteMany({}).exec();
  }
}
