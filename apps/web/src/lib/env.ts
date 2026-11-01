import { z } from "zod";

const brandNameSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().min(1).default("Gift List"),
);

const blankToUndefined = (value: unknown) => {
  if (value == null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalEnvString = z.preprocess(blankToUndefined, z.string().min(1).optional());

/** An address, or a display name plus an address (`Имя <addr>`). */
const emailFromSchema = z.string().trim().min(1).refine((value) => {
  const named = /^(.*)<([^<>]+)>\s*$/.exec(value);
  const address = (named?.[2] ?? value).trim();
  return z.email().safeParse(address).success && (named == null || (named[1] ?? "").trim().length > 0);
}, "EMAIL_FROM must be an address or Name <address>");

// Только для разработки: Expo Go и dev client. Список через запятую; пусто или не задано — [].
const devTrustedOriginsSchema = z.preprocess(
  (value) => {
    if (value === undefined) return [];
    if (typeof value !== "string") return value;
    return value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  },
  z.array(z.string()),
);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  BRAND_NAME: brandNameSchema,
  // Optional so sign-in still works before the operator sets Resend.
  // A blank value is treated as unset; a present but invalid address still fails.
  RESEND_API_KEY: optionalEnvString,
  EMAIL_FROM: z.preprocess(blankToUndefined, emailFromSchema.optional()),
  APPLE_TEAM_ID: optionalEnvString,
  ANDROID_SHA256_CERT_FINGERPRINTS: optionalEnvString,
  AUTH_DEV_TRUSTED_ORIGINS: devTrustedOriginsSchema,
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
