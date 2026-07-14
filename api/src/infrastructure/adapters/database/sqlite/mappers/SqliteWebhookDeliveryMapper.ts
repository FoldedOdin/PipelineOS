import type { WebhookDeliveryDTO } from "../../../../../domain/index.js";

export interface SqliteWebhookDeliveryRow {
  id: string;
  delivery_id: string;
  event: string;
  pipeline_id: string;
  created_at: string;
}

export class SqliteWebhookDeliveryMapper {
  static toDTO(row: SqliteWebhookDeliveryRow): WebhookDeliveryDTO {
    return {
      id: row.id,
      deliveryId: row.delivery_id,
      event: row.event as "push" | "pull_request",
      pipelineId: row.pipeline_id,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  static toRow(dto: WebhookDeliveryDTO): SqliteWebhookDeliveryRow {
    return {
      id: dto.id,
      delivery_id: dto.deliveryId,
      event: dto.event,
      pipeline_id: dto.pipelineId,
      created_at: dto.createdAt ? dto.createdAt.toISOString() : new Date().toISOString(),
    };
  }
}
