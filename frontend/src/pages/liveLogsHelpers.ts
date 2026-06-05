import type { LogLine } from "../hooks/useLogStream";

export function filterLogLines(lines: LogLine[], query: string): LogLine[] {
  const q = query.trim().toLowerCase();
  if (q === "") return lines;
  return lines.filter((line) => `${line.stageName}\n${line.line}`.toLowerCase().includes(q));
}

export function formatLogLines(lines: LogLine[]): string {
  return lines.map((l) => `[${l.timestamp}] ${l.stageName}: ${l.line}`).join("\n");
}
