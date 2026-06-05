import crypto from "node:crypto";
import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.trim() !== "" ? incoming.trim() : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};
