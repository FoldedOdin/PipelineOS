import type { Database } from "better-sqlite3";
import type {
  IWebhookDeliveryRepository,
  RecordWebhookDeliveryInput,
} from "../../../../../domain/index.js";

export class SqliteWebhookDeliveryRepository implements IWebhookDeliveryRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async recordDelivery(input: RecordWebhookDeliveryInput): Promise<boolean> {
    const id = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowStr = new Date().toISOString();

    const res = this.db
      .prepare(`
        INSERT OR IGNORE INTO webhook_deliveries (id, delivery_id, event, pipeline_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(id, input.deliveryId, input.event, input.pipelineId, nowStr);

    return res.changes > 0;
  }

  async deleteAll(): Promise<void> {
    this.db.prepare("DELETE FROM webhook_deliveries").run();
  }
}
