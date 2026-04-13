import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = (req as any).requestId;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const field = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(", ") : "field";
      return res.status(400).json({
        success: false,
        error: {
          code: "UNIQUE_CONSTRAINT_VIOLATION",
          message: `This ${field} is already in use. Please use a different value.`,
          requestId,
        },
      });
    }

    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: {
          code: "RECORD_NOT_FOUND",
          message: "Record not found.",
          requestId,
        },
      });
    }
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR");
  const message = err.message || "Internal server error";

  if (statusCode >= 500) {
    console.error(`ERROR requestId=${requestId}`, err);
  } else {
    console.warn(`WARN requestId=${requestId} status=${statusCode} message=${message}`);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      requestId,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
  });
};

