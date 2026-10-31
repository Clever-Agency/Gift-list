import { z } from "zod";

const brandNameSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().min(1).default("Gift List"),
);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  BRAND_NAME: brandNameSchema,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Typed, lazily validated server env (lazy so `next build` works without secrets). */
export function getEnv(): Env {
  cached ??= envSchema.parse(process.env);
  return cached;
}

/** Display name (AD-24). Blank and missing values use the schema default. Does not read secrets. */
export function getBrandName(): string {
  return envSchema.pick({ BRAND_NAME: true }).parse({
    BRAND_NAME: process.env.BRAND_NAME,
  }).BRAND_NAME;
}
