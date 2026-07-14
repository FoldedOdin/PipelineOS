import express from "express";
import type { Logger } from "pino";
import { createApp } from "../app.js";
import { container, type IApplicationContainer } from "./container.js";

export interface IApplication {
  readonly app: express.Express;
  readonly container: IApplicationContainer;
  start(logger: Logger): Promise<void>;
  stop(logger: Logger): Promise<void>;
}

export async function createApplication(logger: Logger): Promise<IApplication> {
  await container.persistence.connect(logger);
  const app = createApp(logger);
  return {
    app,
    container,
    async start() {
      // Future startup logic if needed
    },
    async stop(stopLogger: Logger) {
      await container.persistence.disconnect();
      stopLogger.info("persistence adapter disconnected");
    },
  };
}
