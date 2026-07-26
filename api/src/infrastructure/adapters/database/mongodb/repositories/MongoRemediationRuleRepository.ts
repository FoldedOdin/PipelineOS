import { isValidObjectId } from "mongoose";
import type {
  IRemediationRuleRepository,
  RemediationRuleDTO,
  CreateRemediationRuleInput,
  UpdateRemediationRuleInput,
} from "../../../../../domain/index.js";
import {
  RemediationRule,
  type RemediationRuleDocument,
} from "../../../../../models/RemediationRule.js";
import { RemediationRuleMapper } from "../mappers/index.js";

export class MongoRemediationRuleRepository implements IRemediationRuleRepository {
  async findById(ruleId: string): Promise<RemediationRuleDTO | null> {
    if (!isValidObjectId(ruleId)) return null;
    const doc = await RemediationRule.findById(ruleId).exec();
    return doc ? RemediationRuleMapper.toDTO(doc as unknown as RemediationRuleDocument) : null;
  }

  async findActive(): Promise<RemediationRuleDTO[]> {
    const docs = await RemediationRule.find({ enabled: true }).exec();
    return docs.map((d: unknown) => RemediationRuleMapper.toDTO(d as RemediationRuleDocument));
  }

  async findAll(): Promise<RemediationRuleDTO[]> {
    const docs = await RemediationRule.find().exec();
    return docs.map((d: unknown) => RemediationRuleMapper.toDTO(d as RemediationRuleDocument));
  }

  async create(input: CreateRemediationRuleInput): Promise<RemediationRuleDTO> {
    const doc = await RemediationRule.create({
      enabled: input.enabled ?? true,
      name: input.name,
      match: {
        pipelineId: input.match.pipelineId ?? null,
        stageName: input.match.stageName ?? null,
        anyPatterns: input.match.anyPatterns ?? [],
        anyHintSubstrings: input.match.anyHintSubstrings ?? [],
      },
      action: {
        type: input.action.type,
        maxAttempts: input.action.maxAttempts,
        backoffSeconds: input.action.backoffSeconds,
      },
      auto: {
        enabled: input.auto?.enabled ?? false,
        minAttempts: input.auto?.minAttempts ?? 10,
        disableBelowSuccessRate: input.auto?.disableBelowSuccessRate ?? 0.2,
      },
      stats: {
        attempts: input.stats?.attempts ?? 0,
        saves: input.stats?.saves ?? 0,
        failures: input.stats?.failures ?? 0,
        lastAppliedAt: input.stats?.lastAppliedAt ?? null,
        lastOutcomeAt: input.stats?.lastOutcomeAt ?? null,
      },
    });
    return RemediationRuleMapper.toDTO(doc as unknown as RemediationRuleDocument);
  }

  async update(
    ruleId: string,
    updates: UpdateRemediationRuleInput,
  ): Promise<RemediationRuleDTO | null> {
    if (!isValidObjectId(ruleId)) return null;
    const setFields: Record<string, unknown> = {};
    if (updates.enabled !== undefined) setFields.enabled = updates.enabled;
    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.match) {
      if (updates.match.pipelineId !== undefined)
        setFields["match.pipelineId"] = updates.match.pipelineId;
      if (updates.match.stageName !== undefined)
        setFields["match.stageName"] = updates.match.stageName;
      if (updates.match.anyPatterns !== undefined)
        setFields["match.anyPatterns"] = updates.match.anyPatterns;
      if (updates.match.anyHintSubstrings !== undefined)
        setFields["match.anyHintSubstrings"] = updates.match.anyHintSubstrings;
    }
    if (updates.action) {
      if (updates.action.type !== undefined) setFields["action.type"] = updates.action.type;
      if (updates.action.maxAttempts !== undefined)
        setFields["action.maxAttempts"] = updates.action.maxAttempts;
      if (updates.action.backoffSeconds !== undefined)
        setFields["action.backoffSeconds"] = updates.action.backoffSeconds;
    }
    if (updates.auto) {
      if (updates.auto.enabled !== undefined) setFields["auto.enabled"] = updates.auto.enabled;
      if (updates.auto.minAttempts !== undefined)
        setFields["auto.minAttempts"] = updates.auto.minAttempts;
      if (updates.auto.disableBelowSuccessRate !== undefined)
        setFields["auto.disableBelowSuccessRate"] = updates.auto.disableBelowSuccessRate;
    }
    if (updates.stats) {
      if (updates.stats.attempts !== undefined)
        setFields["stats.attempts"] = updates.stats.attempts;
      if (updates.stats.saves !== undefined) setFields["stats.saves"] = updates.stats.saves;
      if (updates.stats.failures !== undefined)
        setFields["stats.failures"] = updates.stats.failures;
      if (updates.stats.lastAppliedAt !== undefined)
        setFields["stats.lastAppliedAt"] = updates.stats.lastAppliedAt;
      if (updates.stats.lastOutcomeAt !== undefined)
        setFields["stats.lastOutcomeAt"] = updates.stats.lastOutcomeAt;
    }

    const doc = await RemediationRule.findByIdAndUpdate(
      ruleId,
      { $set: setFields },
      { new: true },
    ).exec();
    return doc ? RemediationRuleMapper.toDTO(doc as unknown as RemediationRuleDocument) : null;
  }

  async delete(ruleId: string): Promise<boolean> {
    if (!isValidObjectId(ruleId)) return false;
    const res = await RemediationRule.deleteOne({ _id: ruleId }).exec();
    return res.deletedCount > 0;
  }

  async deleteAll(): Promise<void> {
    await RemediationRule.deleteMany({}).exec();
  }
}
