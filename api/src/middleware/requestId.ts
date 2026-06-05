import crypto from "node:crypto";
import type { RequestHandler } from "express";

export interface RequestWithId extends Express.Request {
  requestId: string;
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.trim() !== "" ? incoming.trim() : crypto.randomUUID();
  (req as RequestWithId).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};
