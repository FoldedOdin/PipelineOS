import { isValidObjectId } from "mongoose";
import { Run } from "../models/Run.js";

export interface DiagnosisResult {
  summary: string;
  hints: string[];
  llmUsed: boolean;
  patterns: string[];
}

const ERROR_LINE = /^(?:Error|ERROR|FAIL|Failed|failed|\[31m|npm ERR!|AssertionError|Unhandled|panic:|fatal:)/i;

function extractHints(logs: string, maxLines: number): string[] {
  const lines = logs.split(/\r?\n/);
  const hints: string[] = [];
  for (let i = lines.length - 1; i >= 0 && hints.length < maxLines; i -= 1) {
    const line = lines[i]?.trim() ?? "";
    if (line.length === 0) continue;
    if (ERROR_LINE.test(line) || /exit code|Exit code|ECONNREFUSED|ENOENT|EACCES/i.test(line)) {
      hints.unshift(line.length > 400 ? `${line.slice(0, 397)}...` : line);
    }
  }
  return hints.slice(-maxLines);
}

function detectPatterns(logs: string): string[] {
  const patterns: string[] = [];
  if (/npm ERR!/i.test(logs)) patterns.push("npm_install_or_script_error");
  if (/jest|vitest|mocha|pytest|go test/i.test(logs)) patterns.push("test_runner_output");
  if (/eslint|prettier|tsc|TypeScript|TS\d{4}/i.test(logs)) patterns.push("lint_or_typecheck");
  if (/docker|image pull|manifest unknown/i.test(logs)) patterns.push("container_or_image");
  if (/connection refused|ECONNREFUSED|timeout|ETIMEDOUT/i.test(logs)) patterns.push("network_or_timeout");
  if (/permission denied|EACCES|EPERM/i.test(logs)) patterns.push("permission");
  return patterns;
}

async function maybeLlmSummarize(logsTail: string, hints: string[]): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (key === undefined || key === "") return null;

  const endpoint = process.env.OPENAI_DIAGNOSIS_URL ?? "https://api.openai.com/v1/chat/completions";
  const model = process.env.OPENAI_DIAGNOSIS_MODEL ?? "gpt-4o-mini";

  const body = {
    model,
    temperature: 0.2,
    max_tokens: 300,
    messages: [
      {
        role: "system" as const,
        content:
          "You are a CI assistant. Given log excerpts, give a 2-4 sentence diagnosis: likely root cause and next checks. Be concise.",
      },
      {
        role: "user" as const,
        content: `Log tail:\n${logsTail}\n\nError lines:\n${hints.join("\n")}`,
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const json: unknown = await res.json();
  if (typeof json !== "object" || json === null) return null;
  const choices = (json as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first: unknown = choices[0];
  if (typeof first !== "object" || first === null) return null;
  const message = (first as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" && content !== "" ? content.trim() : null;
}

export const diagnosisService = {
  async diagnoseStage(runId: string, stageName: string): Promise<DiagnosisResult | null> {
    if (!isValidObjectId(runId)) return null;
    const run = await Run.findById(runId).select({ stages: 1 }).lean<{ stages?: unknown[] }>().exec();
    if (run === null) return null;
    const stages = Array.isArray(run.stages) ? run.stages : [];
    const stage = stages.find((s) => typeof s === "object" && s !== null && (s as Record<string, unknown>).name === stageName);
    if (stage === undefined) return null;

    const rec = stage as Record<string, unknown>;
    const logs = typeof rec.logs === "string" ? rec.logs : "";
    const status = rec.status;
    const hints = extractHints(logs, 12);
    const patterns = detectPatterns(logs);

    let summary: string;
    if (status === "success") {
      summary = "Stage completed successfully; no failure diagnosis needed.";
    } else if (status === "skipped") {
      summary = "Stage was skipped.";
    } else if (logs.trim().length === 0) {
      summary = "No logs stored yet. Wait for the runner to finish or open live logs.";
    } else {
      summary =
        hints.length > 0
          ? "Heuristic scan found likely error lines below. Review hints and patterns."
          : "No obvious error prefix matched. Scroll the full log or enable OPENAI_API_KEY for an LLM summary.";
    }

    let llmUsed = false;
    if (status === "failed" && logs.trim().length > 0 && process.env.OPENAI_API_KEY) {
      const tail = logs.length > 12_000 ? logs.slice(-12_000) : logs;
      const llm = await maybeLlmSummarize(tail, hints.length > 0 ? hints : [tail.split(/\r?\n/).slice(-5).join("\n")]);
      if (llm !== null) {
        summary = llm;
        llmUsed = true;
      }
    }

    return { summary, hints, llmUsed, patterns };
  },
} as const;
