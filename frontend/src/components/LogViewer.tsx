import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

export interface LogViewerProps {
  text: string;
}

/**
 * Renders monospace log output and keeps the viewport pinned to the latest lines.
 */
export default function LogViewer({ text }: LogViewerProps): ReactElement {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [text]);

  return (
    <pre className="max-h-96 overflow-auto rounded-md bg-black/60 p-3 font-mono text-xs text-slate-100">
      {text}
      <div ref={bottomRef} />
    </pre>
  );
}
