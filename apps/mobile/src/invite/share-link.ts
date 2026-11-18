import { getPublicWebOrigin, normalizeWebOrigin } from "@/config/env";

/**
 * The invite link a person sends (Story 4.7, AD-21): `{origin}/i/{token}`,
 * built exactly like the wishlist link of Story 2.4. The origin comes from
 * configuration (AD-26, D-48); tests may pass one explicitly. `null` means the origin or
 * the token is missing, so the caller shows an error instead of copying a broken
 * link.
 */
export function inviteShareLink(
  token: string,
  origin: string = getPublicWebOrigin(),
): string | null {
  const base = normalizeWebOrigin(origin);
  const value = token.trim();
  if (base.length === 0 || value.length === 0) return null;
  return `${base}/i/${encodeURIComponent(value)}`;
}
