import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  RECOVERY_KEY_HASH: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(24).optional(),
  APP_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validated environment, read lazily so `next build` works without secrets. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Report variable names only, never values.
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new Error(`Invalid environment configuration. Check: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = (): boolean => getEnv().NODE_ENV === "production";
