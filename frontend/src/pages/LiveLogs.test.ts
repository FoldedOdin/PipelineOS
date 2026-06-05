import { describe, expect, it } from "vitest";
import { filterLogLines, formatLogLines } from "./liveLogsHelpers";

describe("LiveLogs helpers", () => {
  const lines = [
    { stageName: "install", line: "npm ci", timestamp: "2026-05-12T00:00:00.000Z" },
    { stageName: "test", line: "Assertion failed", timestamp: "2026-05-12T00:00:01.000Z" },
  ];

  it("formats log lines with timestamp and stage", () => {
    expect(formatLogLines(lines)).toContain("[2026-05-12T00:00:00.000Z] install: npm ci");
  });

  it("filters by stage or message text case-insensitively", () => {
    expect(filterLogLines(lines, "ASSERTION")).toEqual([lines[1]]);
    expect(filterLogLines(lines, "install")).toEqual([lines[0]]);
  });
});
