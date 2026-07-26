import express from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { analyticsRouter } from "./routes/analytics.js";
import { healthRouter } from "./routes/health.js";
import { remediationRouter } from "./routes/remediation.js";
import { runnerRouter } from "./routes/runner.js";
import { runsRouter } from "./routes/runs.js";
import { seedRouter } from "./routes/seed.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { runnersRouter } from "./routes/runners.js";
import { authRouter } from "./routes/auth.js";
import { secretsRouter } from "./routes/secrets.js";
import { artifactsRouter } from "./routes/artifacts.js";
import cookieParser from "cookie-parser";
import { requireAuth } from "./middleware/auth.js";

type RequestWithRawBody = express.Request & { rawBody?: Buffer };

/**
 * Builds the HTTP application with middleware and route modules.
 * Webhook and run routes are mounted in later implementation steps but are wired here for structure.
 */
// MIDDLEWARE ORDERING:
// 1. requestIdMiddleware MUST be first to generate req.requestId.
// 2. pinoHttp reads req.requestId lazily via customProps.
// 3. custom body parser
// 4. routing middlewares
export function createApp(logger: Logger): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      // Lazily evaluate requestId after requestIdMiddleware has attached it
      customProps: (req) => ({
        requestId: (req as unknown as { requestId?: string }).requestId ?? "unknown",
      }),
      // Don't generate id eagerly before middleware runs
      genReqId: (req) => (req as unknown as { requestId?: string }).requestId ?? "unknown",
      autoLogging: false,
    }),
  );
  app.use(corsMiddleware);
  app.use(cookieParser());
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
  app.use(runnerRouter); // internal endpoints
  app.use(seedRouter); // seed endpoint

  app.use("/api/auth", authRouter);

  // Protect all other /api/* routes
  app.use("/api", (req, res, next) => {
    requireAuth(req, res, next);
  });

  app.use(analyticsRouter);
  app.use(remediationRouter);
  app.use(runsRouter);
  app.use(runnersRouter);
  app.use(secretsRouter);
  app.use(artifactsRouter);
  app.use(errorHandler);
  return app;
}
