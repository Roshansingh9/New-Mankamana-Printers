import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const path = `${req.baseUrl || ""}${req.path || req.url}`;

  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);

  console.info(`[Request] ${requestId} ${req.method} ${path}`);

  res.on("finish", () => {
    const took = Date.now() - startedAt;
    const userId = (req as any).user?.id ?? "anonymous";
    console.info(`[Response] ${requestId} ${req.method} ${path} ${res.statusCode} ${took}ms user=${userId}`);
  });

  next();
};

