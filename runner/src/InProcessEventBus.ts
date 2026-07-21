/**
 * InProcessEventBus.ts
 *
 * EventEmitter-backed implementation of IEventBus.
 * All subscriptions live in the same process — ideal for PIP-33.
 *
 * When PipelineOS grows to require cross-process fanout (e.g. multiple runner
 * replicas publishing to a shared dashboard), this implementation can be
 * swapped for a NATS or Redis Streams adapter behind the same IEventBus interface.
 */
import { EventEmitter } from "node:events";
import type { IEventBus, RunnerDomainEvent, EventHandler } from "./events.js";

export class InProcessEventBus implements IEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Prevent Node's default MaxListenersExceededWarning in test environments
    // where many subscriptions are created quickly.
    this.emitter.setMaxListeners(100);
  }

  publish(event: RunnerDomainEvent): void {
    this.emitter.emit(event.type, event);
  }

  subscribe<T extends RunnerDomainEvent>(
    eventType: T["type"],
    handler: EventHandler<T>,
  ): () => void {
    // Cast required because EventEmitter is untyped.
    const listener = (event: T) => {
      void Promise.resolve(handler(event)).catch((err: unknown) => {
        // Swallow async handler errors — they must not crash the runner.
        console.error(`[InProcessEventBus] uncaught error in handler for "${eventType}":`, err);
      });
    };

    this.emitter.on(eventType, listener as (...args: unknown[]) => void);
    return () => {
      this.emitter.off(eventType, listener as (...args: unknown[]) => void);
    };
  }
}

/** Singleton bus — one per runner process. */
export const eventBus: IEventBus = new InProcessEventBus();
