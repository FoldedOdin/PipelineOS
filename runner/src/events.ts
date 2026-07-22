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

export type RunnerDomainEventPayload =
  | {
      type: "RunClaimed";
      runId: string;
      runnerId: string;
      pipelineId: string | null;
    }
  | {
      type: "StageStarted";
      runId: string;
      stageName: string;
      image: string;
      attempt: number;
    }
  | {
      type: "StageFinished";
      runId: string;
      stageName: string;
      exitCode: number;
      durationMs: number;
    }
  | {
      type: "StageFailed";
      runId: string;
      stageName: string;
      exitCode: number;
      attempt: number;
      maxAttempts: number;
    }
  | {
      type: "StageTimedOut";
      runId: string;
      stageName: string;
      limitMs: number;
    }
  | {
      type: "LogChunkReceived";
      runId: string;
      stageName: string;
      /** UTF-8 text chunk (already secret-scrubbed). */
      chunk: string;
      source: "stdout" | "stderr";
    }
  | {
      type: "RunFinished";
      runId: string;
      status: "success" | "failed";
      durationMs: number;
    }
  | {
      type: "RunnerHeartbeat";
      runnerId: string;
      activeRuns: number;
      maxConcurrentRuns: number;
    };

export type RunnerDomainEvent = {
  id: string; // UUID for event deduplication
  version: 1;
  type: RunnerDomainEventPayload["type"];
  occurredAt: string; // ISO 8601 string
  source: string; // e.g., "runner:{runnerId}" or "api"
  payload: RunnerDomainEventPayload;
};

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventHandler<T extends RunnerDomainEventPayload["type"] = RunnerDomainEventPayload["type"]> = (
  event: RunnerDomainEvent & { type: T; payload: Extract<RunnerDomainEventPayload, { type: T }> },
) => any;

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
  subscribe<T extends RunnerDomainEventPayload["type"]>(eventType: T, handler: EventHandler<T>): () => void;
}
