import mongoose, { Schema } from "mongoose";

const webhookDeliverySchema = new Schema(
  {
    /**
     * GitHub’s globally-unique delivery id (`x-github-delivery`).
     * Used for webhook idempotency (dedupe on retries).
     */
    deliveryId: { type: String, required: true, unique: true },
    event: { type: String, required: true, enum: ["push", "pull_request"] },
    pipelineId: { type: String, required: true },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  },
);

// Keep the dedupe table bounded; GitHub may retry within minutes/hours.
// 7 days is generous and keeps storage stable.
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export type WebhookDeliveryDocument = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof webhookDeliverySchema>>;
export const WebhookDelivery = mongoose.model("WebhookDelivery", webhookDeliverySchema);

