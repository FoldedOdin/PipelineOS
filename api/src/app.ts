import express from "express";
import type { Logger } from "pino";
import pinoHttp from "pino-http";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { runnerRouter } from "./routes/runner.js";
import { runsRouter } from "./routes/runs.js";
import { webhooksRouter } from "./routes/webhooks.js";

type RequestWithRawBody = express.Request & { rawBody?: Buffer };

/**
 * Builds the HTTP application with middleware and route modules.
 * Webhook and run routes are mounted in later implementation steps but are wired here for structure.
 */
export function createApp(logger: Logger): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(pinoHttp({ logger }));
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf;
      },
    }),
  );
  app.use(healthRouter);
  app.use(webhooksRouter);
  app.use(runnerRouter);
  app.use(runsRouter);
  app.use(errorHandler);
  return app;
}
