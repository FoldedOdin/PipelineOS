import type { WebhookDeliveryDTO } from "../../../../../domain/index.js";
import type { WebhookDeliveryDocument } from "../../../../../models/WebhookDelivery.js";

export class WebhookDeliveryMapper {
  static toDTO(doc: WebhookDeliveryDocument): WebhookDeliveryDTO {
    const docAny = doc as unknown as { _id?: { toString(): string }; createdAt?: Date };
    return {
      id: docAny._id?.toString() ?? doc.deliveryId,
      deliveryId: doc.deliveryId,
      event: doc.event as "push" | "pull_request",
      pipelineId: doc.pipelineId,
      createdAt: docAny.createdAt ? new Date(docAny.createdAt) : new Date(),
    };
  }
}
