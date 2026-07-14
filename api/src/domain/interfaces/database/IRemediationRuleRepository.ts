import type {
  RemediationRuleDTO,
  CreateRemediationRuleInput,
  UpdateRemediationRuleInput,
} from "../../dto/index.js";

export interface IRemediationRuleRepository {
  findById(ruleId: string): Promise<RemediationRuleDTO | null>;
  findActive(): Promise<RemediationRuleDTO[]>;
  findAll(): Promise<RemediationRuleDTO[]>;
  create(input: CreateRemediationRuleInput): Promise<RemediationRuleDTO>;
  update(ruleId: string, updates: UpdateRemediationRuleInput): Promise<RemediationRuleDTO | null>;
  delete(ruleId: string): Promise<boolean>;
  deleteAll(): Promise<void>;
}
