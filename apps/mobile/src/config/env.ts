function readPublic(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * An origin is scheme, host and optional port, nothing else. Trailing slashes are
 * allowed so `https://gift.example/` works; a path, query or other scheme is not
 * an origin and must not become a share link by accident.
 */
const WEB_ORIGIN = /^(https?:\/\/[^/?#\s]+)\/*$/i;

/** ` https://gift.example/ ` → `https://gift.example`; anything else → "" (no wrong host). */
export function normalizeWebOrigin(value: string | undefined): string {
  return WEB_ORIGIN.exec(readPublic(value))?.[1] ?? "";
}

/** Empty `EXPO_PUBLIC_BRAND_NAME` becomes the fallback only in this module (AD-24). */
export function getBrandName(): string {
  const value = readPublic(process.env.EXPO_PUBLIC_BRAND_NAME);
  return value.length > 0 ? value : "Gift List";
}

/** Empty means "not configured". Callers show the catalog phrase and do not throw. */
export function getApiBaseUrl(): string {
  return readPublic(process.env.EXPO_PUBLIC_API_BASE_URL);
}

export function getAuthorUrl(): string {
  return readPublic(process.env.EXPO_PUBLIC_AUTHOR_URL);
}

/**
 * Public site origin for outbound links (Q-2, AD-26). `EXPO_PUBLIC_WEB_ORIGIN`
 * wins; when it is empty the API origin is used, because the site and the API
 * share one domain and App Links claim `/l/*` there. A set but invalid value
 * does not fall back: it returns "" instead of guessing a different host.
 */
export function resolvePublicWebOrigin(
  configured: string | undefined,
  apiBase: string | undefined,
): string {
  return readPublic(configured).length > 0
    ? normalizeWebOrigin(configured)
    : normalizeWebOrigin(apiBase);
}

/** Empty means "not configured": callers must not build or copy a link from it. */
export function getPublicWebOrigin(): string {
  return resolvePublicWebOrigin(
    process.env.EXPO_PUBLIC_WEB_ORIGIN,
    process.env.EXPO_PUBLIC_API_BASE_URL,
  );
}
