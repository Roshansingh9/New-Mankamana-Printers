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
import clientWalletRoutes from "./routes/wallet/client-wallet.routes";
import adminWalletRoutes from "./routes/wallet/admin-wallet.routes";
import { globalErrorHandler } from "./middleware/error.middleware";
import swaggerUi from "swagger-ui-express";
const swaggerOutput = require("../swagger-output.json");

const app = express();
const port = process.env.PORT || 8005;

// ── Security headers
app.use(helmet());

// ── CORS: whitelist known origins only
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((o) => o.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      // allow server-to-server or same-origin requests (no Origin header)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
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

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerOutput));

//health check
app.get("/",(req:Request,res:Response)=>{
  res.json({message:"API is running"})
}
)

app.use(globalErrorHandler);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  // Advance any ORDER_PLACED orders that were stuck before server restart
  sweepStalePlacedOrders().catch((err) =>
    console.error("[AutoTransition] Startup sweep failed:", err)
  );
});

export default app;