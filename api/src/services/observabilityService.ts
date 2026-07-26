import { EventEmitter } from "node:events";

export class ObservabilityService {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  public ingestBatch(events: any[]): void {
    for (const event of events) {
      if (typeof event === "object" && event !== null && typeof event.type === "string") {
        this.emitter.emit(event.type, event);
        this.emitter.emit("*", event);
        
        // Also emit by runId for targeted SSE/WebSocket listeners
        if (event.payload && typeof event.payload.runId === "string") {
          this.emitter.emit(`run:${event.payload.runId}`, event);
        }
      }
    }
  }

  public subscribe(eventType: string, listener: (event: any) => void): () => void {
    this.emitter.on(eventType, listener);
    return () => {
      this.emitter.off(eventType, listener);
    };
  }

  public subscribeToRun(runId: string, listener: (event: any) => void): () => void {
    const eventName = `run:${runId}`;
    this.emitter.on(eventName, listener);
    return () => {
      this.emitter.off(eventName, listener);
    };
  }
}

export const observabilityService = new ObservabilityService();
