import { Request, Response, NextFunction } from "express";
import { recordEndpointDuration } from "../utils/performance-metrics";

export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const key = `${req.method} ${req.baseUrl || ""}${req.path || req.url}`;
    recordEndpointDuration(key, durationMs);

    if (durationMs >= 1000) {
      console.warn(`[Slow API] ${key} took ${durationMs}ms (status ${res.statusCode})`);
    }
  });

  next();
};
