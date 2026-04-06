import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const errorValue: unknown = err;
  req.log.error({ err: errorValue }, "unhandled error");
  res.status(500).json({ error: "internal_error" });
};
