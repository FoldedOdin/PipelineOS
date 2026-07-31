import { readFileSync } from "fs";

const payload = {
  "page": 1,
  "limit": 20,
  "total": 5,
  "items": [
    {
      "id": "run_1785071849542_jiqnhys",
      "pipelineId": "foldedodin/kpm-clinic",
      "commitSha": "b85fe1c13a9f1db91e61893cb85d9d808b382640",
      "branch": "main",
      "triggeredBy": "unknown",
      "event": "push",
      "status": "running",
      "stages": [],
      "startedAt": "2026-07-26T13:17:31.268Z",
      "finishedAt": null,
      "durationMs": null,
      "lastHeartbeatAt": "2026-07-26T13:18:11.276Z",
      "claimedBy": "runner-compose-1",
      "claimExpiresAt": "2026-07-26T13:19:11.276Z",
      "remediationHistory": [],
      "createdAt": "2026-07-26T13:17:29.542Z"
    }
  ]
};

function asString(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

function asRunStatus(value) {
  return value === "queued" ||
    value === "running" ||
    value === "success" ||
    value === "failed" ||
    value === "cancelled"
    ? value
    : null;
}

function parseRunsList(payload) {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload;
  const itemsRaw = obj.items;
  const totalRaw = obj.total;
  const total = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : 0;
  if (!Array.isArray(itemsRaw)) return null;

  const items = [];
  for (const item of itemsRaw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item;
    const id = asString(r.id || r._id);
    const status = asRunStatus(r.status);
    const pipelineId = asString(r.pipelineId);
    const branch = asString(r.branch);
    const commitSha = asString(r.commitSha);
    const triggeredBy = asString(r.triggeredBy);
    const startedAt = asString(r.startedAt);
    const finishedAt = asString(r.finishedAt);
    if (!id || !status || !pipelineId || !branch || !commitSha || !triggeredBy) {
      console.log("Missing properties", { id, status, pipelineId, branch, commitSha, triggeredBy });
      continue;
    }
    items.push({ id, status, pipelineId, branch, commitSha, triggeredBy, startedAt, finishedAt });
  }

  return { items, total };
}

console.log(parseRunsList(payload));
