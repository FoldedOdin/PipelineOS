import type { RemediationRuleDTO } from "../../../../../domain/index.js";
import type { RemediationRuleDocument } from "../../../../../models/RemediationRule.js";

export class RemediationRuleMapper {
  static toDTO(doc: RemediationRuleDocument): RemediationRuleDTO {
    return {
      id: doc._id.toString(),
      enabled: doc.enabled,
      name: doc.name,
      match: {
        pipelineId: doc.match.pipelineId ?? null,
        stageName: doc.match.stageName ?? null,
        anyPatterns: doc.match.anyPatterns ?? [],
        anyHintSubstrings: doc.match.anyHintSubstrings ?? [],
      },
      action: {
        type: doc.action.type,
        maxAttempts: doc.action.maxAttempts,
        backoffSeconds: doc.action.backoffSeconds,
      },
      auto: {
        enabled: doc.auto.enabled,
        minAttempts: doc.auto.minAttempts,
        disableBelowSuccessRate: doc.auto.disableBelowSuccessRate,
      },
      stats: {
        attempts: doc.stats.attempts,
        saves: doc.stats.saves,
        failures: doc.stats.failures,
        lastAppliedAt: doc.stats.lastAppliedAt ? new Date(doc.stats.lastAppliedAt) : null,
        lastOutcomeAt: doc.stats.lastOutcomeAt ? new Date(doc.stats.lastOutcomeAt) : null,
      },
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    };
  }
}
