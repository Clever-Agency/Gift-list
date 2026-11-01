/**
 * Local Expo web runs on another origin than Next (typically :8081 vs :3000).
 * Production is one domain (AD-26), so nothing is trusted by default: the developer
 * lists Expo web origins in `AUTH_DEV_TRUSTED_ORIGINS` (CLE-42), next to `exp://`.
 * Credentialed fetches need the exact origin echoed back, never `*`.
 * Production never gets these headers, even if the variable leaks into its env.
 */

/** Echo this origin on `/api/v1` CORS, or null when the request must stay same-origin. */
export function allowedDevCorsOrigin(
  origin: string | null,
  devTrustedOrigins: readonly string[],
  nodeEnv: string | undefined,
): string | null {
  if (nodeEnv === "production" || origin == null) return null;
  if (!origin.startsWith("http://") && !origin.startsWith("https://")) return null;
  return devTrustedOrigins.includes(origin) ? origin : null;
}

const CORS_OPTIONS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Accept-Language, Authorization, Content-Type, expo-origin",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
};

/** Adds credentialed CORS headers for one already-allowed origin. */
export function applyDevCors(headers: Headers, origin: string): void {
  headers.set("Access-Control-Allow-Origin", origin);
  for (const [key, value] of Object.entries(CORS_OPTIONS)) {
    headers.set(key, value);
  }
}
