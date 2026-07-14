export type RemediationActionType = "retry_stage";

export interface RemediationRuleMatchDTO {
  pipelineId: string | null;
  stageName: string | null;
  anyPatterns: string[];
  anyHintSubstrings: string[];
}

export interface RemediationRuleActionDTO {
  type: RemediationActionType;
  maxAttempts: number;
  backoffSeconds: number;
}

export interface RemediationRuleAutoDTO {
  enabled: boolean;
  minAttempts: number;
  disableBelowSuccessRate: number;
}

export interface RemediationRuleStatsDTO {
  attempts: number;
  saves: number;
  failures: number;
  lastAppliedAt: Date | null;
  lastOutcomeAt: Date | null;
}

export interface RemediationRuleDTO {
  id: string;
  enabled: boolean;
  name: string;
  match: RemediationRuleMatchDTO;
  action: RemediationRuleActionDTO;
  auto: RemediationRuleAutoDTO;
  stats: RemediationRuleStatsDTO;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRemediationRuleInput {
  enabled?: boolean;
  name: string;
  match: RemediationRuleMatchDTO;
  action: RemediationRuleActionDTO;
  auto?: RemediationRuleAutoDTO;
  stats?: Partial<RemediationRuleStatsDTO>;
}

export interface UpdateRemediationRuleInput {
  enabled?: boolean;
  name?: string;
  match?: Partial<RemediationRuleMatchDTO>;
  action?: Partial<RemediationRuleActionDTO>;
  auto?: Partial<RemediationRuleAutoDTO>;
  stats?: Partial<RemediationRuleStatsDTO>;
}
