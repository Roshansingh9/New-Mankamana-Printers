import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8005),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  ALLOWED_ORIGINS: z.string().min(1).default("http://localhost:3000,http://localhost:3001"),
  CRON_SECRET: z.string().optional(),
  BACKEND_REGION: z.string().optional(),
  ENFORCE_REGION_MATCH: z.enum(["true", "false"]).optional(),
  REDIS_URL: z.string().optional(),
  REDIS_DISABLED: z.enum(["true", "false"]).optional(),
  SMTP_EMAIL: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export const assertValidEnv = (): AppEnv => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const reason = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration. ${reason}`);
  }
  return parsed.data;
};

