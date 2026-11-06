import { getPublicWebOrigin, normalizeWebOrigin } from "@/config/env";

/**
 * The one link an owner copies (Story 2.4, AD-6): `{origin}/l/{publicToken}`.
 * The origin comes from configuration (Q-2); tests may pass one explicitly.
 * `null` means the origin or the token is missing, so the caller shows an error
 * instead of copying a broken link.
 */
export function wishlistShareLink(
  publicToken: string,
  origin: string = getPublicWebOrigin(),
): string | null {
  const base = normalizeWebOrigin(origin);
  const token = publicToken.trim();
  if (base.length === 0 || token.length === 0) return null;
  return `${base}/l/${encodeURIComponent(token)}`;
}
