/**
 * events.ts
 *
 * Typed domain events emitted by the Runner during pipeline execution.
 *
 * The IEventBus abstraction deliberately carries no infrastructure detail —
 * the initial implementation is an in-process EventEmitter (InProcessEventBus).
 * If PipelineOS grows to require distributed fanout, the same interface can be
 * backed by NATS, Redis Streams, or Kafka without changing any application logic.
 */

// ---------------------------------------------------------------------------
// Domain event union
// ---------------------------------------------------------------------------

export type RunnerDomainEvent =
  | {
      type: "RunClaimed";
      runId: string;
      runnerId: string;
      pipelineId: string | null;
      ts: Date;
    }
  | {
      type: "StageStarted";
      runId: string;
      stageName: string;
      image: string;
      attempt: number;
      ts: Date;
    }
  | {
      type: "StageFinished";
      runId: string;
      stageName: string;
      exitCode: number;
      durationMs: number;
      ts: Date;
    }
  | {
      type: "StageFailed";
      runId: string;
      stageName: string;
      exitCode: number;
      attempt: number;
      maxAttempts: number;
      ts: Date;
    }
  | {
      type: "StageTimedOut";
      runId: string;
      stageName: string;
      limitMs: number;
      ts: Date;
    }
  | {
      type: "LogChunkReceived";
      runId: string;
      stageName: string;
      /** UTF-8 text chunk (already secret-scrubbed). */
      chunk: string;
      source: "stdout" | "stderr";
      ts: Date;
    }
  | {
      type: "RunFinished";
      runId: string;
      status: "success" | "failed";
      durationMs: number;
      ts: Date;
    }
  | {
      type: "RunnerHeartbeat";
      runnerId: string;
      activeRuns: number;
      maxConcurrentRuns: number;
      ts: Date;
    };

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventHandler<T extends RunnerDomainEvent = RunnerDomainEvent> = (event: T) => any;

export interface IEventBus {
  /**
   * Publish an event to all subscribers registered for its type.
   * Fire-and-forget: async handlers are not awaited.
   */
  publish(event: RunnerDomainEvent): void;

  /**
   * Subscribe a handler for events of a specific type.
   * Returns an unsubscribe function.
   */
  subscribe<T extends RunnerDomainEvent>(
    eventType: T["type"],
    handler: EventHandler<T>,
  ): () => void;
}
