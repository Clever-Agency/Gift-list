/**
 * Product identity and the public support contact (AD-24, D-35, D-48).
 *
 * The one source of the displayed product name and the author address: `apps/web`
 * and `apps/mobile` fall back to these constants when their brand variable is
 * empty, so neither app keeps a second literal. There is no React, Prisma or env
 * here (AD-17, AD-26); `apps/mobile/app.config.ts` reads this module through the
 * `@gift-list/contracts/brand` subpath, before Metro, so it stays importable by
 * plain Node.
 */
export const PRODUCT_NAME = "WishMoon";

/** Product support mailbox behind «Написать автору»; owner's decision 2026-11-18 (D-35, D-48), not a secret. */
export const AUTHOR_EMAIL = "support@wishmoon.clever-agency.dev";

/** `mailto:` link without a subject; derived, so the address is edited once. */
export const AUTHOR_MAILTO = `mailto:${AUTHOR_EMAIL}`;

/**
 * A `mailto:` link with an optional subject. The subject is percent-encoded, so
 * Cyrillic, spaces, `&` and `?` survive any mail client. A blank subject adds no
 * query string at all: it is the same link as `AUTHOR_MAILTO`.
 */
export function authorMailto(subject?: string): string {
  const value = subject?.trim() ?? "";
  if (value.length === 0) return AUTHOR_MAILTO;
  return `${AUTHOR_MAILTO}?subject=${encodeURIComponent(value)}`;
}
