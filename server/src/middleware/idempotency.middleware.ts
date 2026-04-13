import { NextFunction, Request, Response } from "express";
import { createHash } from "crypto";

type CachedResponse = {
  status: number;
  body: unknown;
  createdAt: number;
};

const IDEMPOTENCY_TTL_MS = 2 * 60 * 1000;
const completed = new Map<string, CachedResponse>();
const inFlight = new Set<string>();

const clearExpired = () => {
  const now = Date.now();
  for (const [key, value] of completed.entries()) {
    if (now - value.createdAt > IDEMPOTENCY_TTL_MS) {
      completed.delete(key);
    }
  }
};

export const requireIdempotencyKey = (req: Request, res: Response, next: NextFunction) => {
  clearExpired();

  const headerKey = req.header("Idempotency-Key")?.trim();
  const derivedPayload = JSON.stringify({
    params: req.params,
    query: req.query,
    body: req.body,
  });
  const derivedKey = createHash("sha256").update(derivedPayload).digest("hex");
  const idempotencyKey = headerKey || derivedKey;
  if (!headerKey) {
    res.setHeader("x-idempotency-derived", "true");
  }

  const userId = (req as any).user?.id ?? "anonymous";
  const key = `${userId}:${req.method}:${req.baseUrl || ""}${req.path}:${idempotencyKey}`;

  const cached = completed.get(key);
  if (cached) {
    res.setHeader("x-idempotent-replay", "true");
    return res.status(cached.status).json(cached.body);
  }

  if (inFlight.has(key)) {
    return res.status(409).json({
      success: false,
      error: {
        code: "REQUEST_IN_PROGRESS",
        message: "An identical request is already being processed.",
      },
    });
  }

  inFlight.add(key);

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      completed.set(key, {
        status: res.statusCode,
        body,
        createdAt: Date.now(),
      });
    }
    return originalJson(body);
  }) as Response["json"];

  res.on("finish", () => {
    inFlight.delete(key);
  });

  next();
};
