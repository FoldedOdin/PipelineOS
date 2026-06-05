import crypto from "node:crypto";
import type { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.trim() !== "" ? incoming.trim() : crypto.randomUUID();
  res.setHeader("x-request-id", requestId);
  next();
};
