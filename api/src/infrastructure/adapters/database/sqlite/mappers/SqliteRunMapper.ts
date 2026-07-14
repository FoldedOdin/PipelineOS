import type { RunDTO, RemediationAttemptDTO, StageDTO } from "../../../../../domain/index.js";

export interface SqliteRunRow {
  id: string;
  pipeline_id: string;
  commit_sha: string;
  branch: string;
  triggered_by: string;
  event: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  last_heartbeat_at: string | null;
  claimed_by: string | null;
  claim_expires_at: string | null;
  remediation_history_json: string;
  created_at: string;
}

export class SqliteRunMapper {
  static toDTO(row: SqliteRunRow, stages: StageDTO[] = []): RunDTO {
    let remediationHistory: RemediationAttemptDTO[] | undefined;
    try {
      if (row.remediation_history_json) {
        const parsed = JSON.parse(row.remediation_history_json);
        if (Array.isArray(parsed)) {
          remediationHistory = parsed.map((item: unknown) => {
            const r = item as Record<string, unknown>;
            return {
              ruleId: typeof r.ruleId === "string" ? r.ruleId : undefined,
              ruleName: typeof r.ruleName === "string" ? r.ruleName : undefined,
              stageName: typeof r.stageName === "string" ? r.stageName : undefined,
              attemptedAt: typeof r.attemptedAt === "string" ? new Date(r.attemptedAt) : new Date(),
              outcome: r.outcome as "success" | "failed" | "pending" | undefined,
            };
          });
        }
      }
    } catch {
      remediationHistory = undefined;
    }

    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      commitSha: row.commit_sha,
      branch: row.branch,
      triggeredBy: row.triggered_by,
      event: row.event as RunDTO["event"],
      status: row.status as RunDTO["status"],
      stages,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
      durationMs: row.duration_ms ?? null,
      lastHeartbeatAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at) : null,
      claimedBy: row.claimed_by ?? null,
      claimExpiresAt: row.claim_expires_at ? new Date(row.claim_expires_at) : null,
      remediationHistory,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  static toRow(dto: RunDTO): SqliteRunRow {
    return {
      id: dto.id,
      pipeline_id: dto.pipelineId,
      commit_sha: dto.commitSha,
      branch: dto.branch,
      triggered_by: dto.triggeredBy,
      event: dto.event,
      status: dto.status,
      started_at: dto.startedAt ? dto.startedAt.toISOString() : null,
      finished_at: dto.finishedAt ? dto.finishedAt.toISOString() : null,
      duration_ms: dto.durationMs ?? null,
      last_heartbeat_at: dto.lastHeartbeatAt ? dto.lastHeartbeatAt.toISOString() : null,
      claimed_by: dto.claimedBy ?? null,
      claim_expires_at: dto.claimExpiresAt ? dto.claimExpiresAt.toISOString() : null,
      remediation_history_json: JSON.stringify(dto.remediationHistory ?? []),
      created_at: dto.createdAt ? dto.createdAt.toISOString() : new Date().toISOString(),
    };
  }
}
