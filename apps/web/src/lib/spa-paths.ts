/** Prefixes Next.js serves itself (AD-26). Everything else is the Expo SPA. */
export const NEXT_OWNED_PREFIXES = [
  "/api",
  "/l",
  "/i",
  "/unsubscribe",
  "/admin",
  "/.well-known",
] as const;

/**
 * True when Next.js must answer the path (including a 404 of its own).
 * `/l` and `/i` match only as a whole segment, so `/lists`, `/login`, `/long`, and `/invite` stay on the SPA.
 */
export function isNextOwnedPath(pathname: string): boolean {
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalized =
    withSlash.length > 1 && withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
  return NEXT_OWNED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

/**
 * Fallback rewrite sources for `spa-index.html`: `/` and every path {@link isNextOwnedPath} rejects.
 * The negative lookahead is the path-to-regexp form of those prefixes.
 */
export function spaFallbackRewriteSources(): string[] {
  const alternatives = NEXT_OWNED_PREFIXES.map((prefix) => {
    const body = prefix.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return `${body}(?:/|$)`;
  }).join("|");
  return ["/", `/:path((?!${alternatives}).*)`];
}
