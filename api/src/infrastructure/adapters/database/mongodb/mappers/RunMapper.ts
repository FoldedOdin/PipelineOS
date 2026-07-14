import type { RunDTO, RemediationAttemptDTO } from "../../../../../domain/index.js";
import type { RunDocument } from "../../../../../models/Run.js";
import { StageMapper } from "./StageMapper.js";

export class RunMapper {
  static toDTO(doc: RunDocument): RunDTO {
    const rawHistory = (doc as unknown as { remediationHistory?: RemediationAttemptDTO[] }).remediationHistory;
    return {
      id: doc._id.toString(),
      pipelineId: doc.pipelineId,
      commitSha: doc.commitSha,
      branch: doc.branch,
      triggeredBy: doc.triggeredBy,
      event: doc.event,
      status: doc.status,
      stages: (doc.stages ?? []).map((s) => StageMapper.toDTO(s)),
      startedAt: doc.startedAt ? new Date(doc.startedAt) : null,
      finishedAt: doc.finishedAt ? new Date(doc.finishedAt) : null,
      durationMs: doc.durationMs ?? null,
      lastHeartbeatAt: doc.lastHeartbeatAt ? new Date(doc.lastHeartbeatAt) : null,
      claimedBy: doc.claimedBy ?? null,
      claimExpiresAt: doc.claimExpiresAt ? new Date(doc.claimExpiresAt) : null,
      remediationHistory: rawHistory ? rawHistory.map((h) => ({ ...h, attemptedAt: new Date(h.attemptedAt) })) : undefined,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    };
  }
}
