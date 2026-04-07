import type { RequestHandler } from "express";

/**
 * Protects internal runner -> API endpoints using `INTERNAL_API_KEY`.
 * This is not user auth; it's service-to-service authentication for Phase 1.
 */
export const requireInternalApiKey: RequestHandler = (req, res, next) => {
  const expected = process.env.INTERNAL_API_KEY;
  if (expected === undefined || expected === "" || expected.startsWith("CHANGE_ME")) {
    res.status(500).json({ error: "internal_api_key_not_configured" });
    return;
  }

  const provided = req.header("x-internal-api-key");
  if (provided === undefined || provided === "") {
    res.status(401).json({ error: "missing_internal_api_key" });
    return;
  }

  if (provided !== expected) {
    res.status(401).json({ error: "invalid_internal_api_key" });
    return;
  }

  next();
};

