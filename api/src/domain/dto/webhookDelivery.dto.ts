export interface WebhookDeliveryDTO {
  id: string;
  deliveryId: string;
  event: "push" | "pull_request";
  pipelineId: string;
  createdAt: Date;
}

export interface RecordWebhookDeliveryInput {
  deliveryId: string;
  event: "push" | "pull_request";
  pipelineId: string;
}
