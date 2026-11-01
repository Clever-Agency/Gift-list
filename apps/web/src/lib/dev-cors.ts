/**
 * Local Expo web runs on another origin than Next (typically :8081 vs :3000).
 * Production is one domain (AD-26), so these origins are trusted only outside production.
 * Credentialed fetches need the exact origin echoed back, never `*`.
 *
 * Ports: Metro web 8081, the next free ports 8082–8085, and the older Expo web port 19006.
 */
export const EXPO_WEB_DEV_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8082",
  "http://localhost:8083",
  "http://127.0.0.1:8083",
  "http://localhost:8084",
  "http://127.0.0.1:8084",
  "http://localhost:8085",
  "http://127.0.0.1:8085",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
] as const;

const ALLOWED = new Set<string>(EXPO_WEB_DEV_ORIGINS);

/** Origins Better Auth may accept from Expo web while developing. Empty in production. */
export function trustedExpoWebOrigins(nodeEnv: string | undefined): string[] {
  return nodeEnv === "production" ? [] : [...EXPO_WEB_DEV_ORIGINS];
}

/** Echo this origin on `/api/v1` CORS, or null when the request must stay same-origin. */
export function allowedExpoWebDevOrigin(origin: string | null, nodeEnv: string | undefined): string | null {
  if (nodeEnv === "production" || origin == null) return null;
  return ALLOWED.has(origin) ? origin : null;
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
