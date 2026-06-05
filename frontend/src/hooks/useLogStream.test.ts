import { describe, expect, it } from "vitest";
import { parseLogStreamEvent, splitLinesPreservingRemainder } from "./useLogStream";

describe("useLogStream helpers", () => {
  it("parses valid structured log events", () => {
    const event = parseLogStreamEvent(
      JSON.stringify({
        type: "log",
        runId: "run-1",
        stageName: "test",
        chunk: "ok\n",
        timestamp: "2026-05-12T00:00:00.000Z",
      }),
    );

    expect(event).toEqual({
      type: "log",
      runId: "run-1",
      stageName: "test",
      chunk: "ok\n",
      timestamp: "2026-05-12T00:00:00.000Z",
    });
  });

  it("keeps incomplete trailing log lines as a remainder", () => {
    expect(splitLinesPreservingRemainder("first\nsecond")).toEqual({
      lines: ["first"],
      remainder: "second",
    });
  });
});
