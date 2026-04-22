import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth/auth.routes";
import adminRoutes from "./routes/admin/admin.routes";
import publicRoutes from "./routes/auth/public.routes";
import userRoutes from "./routes/auth/user.routes";
import templateRoutes from "./routes/design/template.routes";
import designSubmissionRoutes from "./routes/design/design-submission.routes";
import designRoutes from "./routes/design/design.routes";
import productOrderRoutes from "./routes/orders/product-order.routes";
import { sweepStalePlacedOrders } from "./services/orders/product-order.service";
import prisma from "./connect";
import { preWarmCatalogCache } from "./utils/cache-warmup";
import clientWalletRoutes from "./routes/wallet/client-wallet.routes";
import adminWalletRoutes from "./routes/wallet/admin-wallet.routes";
import { globalErrorHandler } from "./middleware/error.middleware";
import { performanceMiddleware } from "./middleware/performance.middleware";
import { assertRegionConsistency } from "./utils/region-check";
import { assertValidEnv } from "./utils/env";
import { requestContextMiddleware } from "./middleware/request-context.middleware";
import swaggerUi from "swagger-ui-express";
let swaggerOutput: object | null = null;
if (process.env.VERCEL !== "1") {
  try {
    swaggerOutput = require("../swagger-output.json");
  } catch {
    // swagger-output.json is generated locally via `npm run swagger`; skip if absent
  }
}

const app = express();
const port = process.env.PORT || 8005;
assertValidEnv();
assertRegionConsistency();

// ── Security headers
// crossOriginResourcePolicy: Helmet defaults to "same-origin" which blocks browsers
// from loading any resource (images, fonts, etc.) served by this API from a different
// origin (e.g. frontend on localhost:3000/3001 or Vercel loading from the API domain).
// "cross-origin" is the correct setting for an API server that intentionally serves
// resources to multiple frontend origins — CORS already controls which origins can
// make requests; CORP would only duplicate that restriction while breaking img/font loads.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ── CORS: whitelist known origins only
// Supports exact entries and wildcard patterns in ALLOWED_ORIGINS.
// Example:
//   ALLOWED_ORIGINS=https://new-mankamana-printers.vercel.app,https://new-mankamana-printers-*.vercel.app,http://localhost:3000
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wildcardToRegex = (pattern: string) => {
  const regexBody = pattern
    .split("*")
    .map((part) => escapeRegex(part))
    .join(".*");
  return new RegExp(`^${regexBody}$`);
};

const exactAllowedOrigins = allowedOrigins.filter((o) => !o.includes("*"));
const wildcardAllowedOriginRegexes = allowedOrigins
  .filter((o) => o.includes("*"))
  .map((o) => wildcardToRegex(o));
app.use(
  cors({
    origin: (origin, cb) => {
      // allow server-to-server or same-origin requests (no Origin header)
      if (!origin) return cb(null, true);

      // exact match from ALLOWED_ORIGINS
      if (exactAllowedOrigins.includes(origin)) return cb(null, true);

      // wildcard match from ALLOWED_ORIGINS (e.g. https://project-*.vercel.app)
      if (wildcardAllowedOriginRegexes.some((rx) => rx.test(origin))) {
        return cb(null, true);
      }

      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Rate limiter for auth endpoints (max 20 attempts / 15 min per IP)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again in 15 minutes." },
});

app.use(express.json());
app.use(requestContextMiddleware);
app.use(performanceMiddleware);
app.use((_req, res, next) => {
  if (process.env.BACKEND_REGION) {
    res.setHeader("x-backend-region", process.env.BACKEND_REGION);
  }
  next();
});

app.use("/api/v1", publicRoutes);
app.use("/api/v1/uploads", require("./routes/upload.routes").default);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/auth", authRateLimiter, authRoutes);          // rate-limited
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/templates", templateRoutes);
app.use("/api/v1/design-submissions", designSubmissionRoutes);
app.use("/api/v1", designRoutes);
app.use("/api/v1/orders", productOrderRoutes);
app.use("/api/v1/wallet", clientWalletRoutes);
app.use("/api/v1/admin/wallet", adminWalletRoutes);

// Swagger UI (only available when swagger-output.json has been generated locally)
if (swaggerOutput) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerOutput));
}

// Health check
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "API is running" });
});

// Vercel Cron — sweeps stale ORDER_PLACED orders every 5 minutes
app.get("/api/v1/admin/sweep", (req: Request, res: Response) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers["authorization"] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  sweepStalePlacedOrders()
    .then(() => res.json({ ok: true }))
    .catch((err) => res.status(500).json({ error: err.message }));
});

app.use((req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      requestId: (req as any).requestId,
    },
  });
});

app.use(globalErrorHandler);

// Only start the HTTP server when running directly (not on Vercel serverless)
if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    // Pre-warm DB connection pool then immediately warm catalog cache
    prisma.$queryRaw`SELECT 1`
      .then(() => {
        console.log("[DB] Connection pool warmed up");
        return preWarmCatalogCache();
      })
      .catch(() => {}); // non-fatal
    sweepStalePlacedOrders().catch((err) =>
      console.error("[AutoTransition] Startup sweep failed:", err)
    );
  });
}

export default app;
