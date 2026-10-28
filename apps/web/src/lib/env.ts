import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Typed, lazily validated server env (lazy so `next build` works without secrets). */
export function getEnv(): Env {
  cached ??= envSchema.parse(process.env);
  return cached;
}
