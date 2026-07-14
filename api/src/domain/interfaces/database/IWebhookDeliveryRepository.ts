import type { RecordWebhookDeliveryInput } from "../../dto/index.js";

export interface IWebhookDeliveryRepository {
  /**
   * Attempts to record a unique GitHub delivery ID for idempotency.
   * Returns true if newly recorded, false if already processed.
   */
  recordDelivery(input: RecordWebhookDeliveryInput): Promise<boolean>;
  deleteAll(): Promise<void>;
}
