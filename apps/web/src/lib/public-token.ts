/**
 * Story 3.3 (AD-7, AD-26): a public list token is exactly one short path segment.
 *
 * The read gate and the page share this check, so a malformed value is answered
 * as `not_found` before the database and the value is never logged. It is a
 * length and path-shape check only: the real token is an opaque CUID2 and the
 * database decides whether it exists.
 */

/** A CUID2 is 24 characters; this cap keeps the segment from becoming a payload. */
export const PUBLIC_TOKEN_MAX_LENGTH = 128;

export function isPublicTokenSegment(token: string): boolean {
  return hasTokenSegmentShape(token) && !UNSAFE_TARGET_CHARACTERS.test(token);
}

function hasTokenSegmentShape(token: string): boolean {
  if (token.length === 0 || token.length > PUBLIC_TOKEN_MAX_LENGTH) return false;
  // A dot segment, or a dot pair anywhere in the segment, can traverse or
  // normalise away part of the path once a browser resolves it.
  return token !== "." && !token.includes("..");
}

/** Keep the invite API's existing token shape (Story 4.7). */
export function isInviteTokenSegment(token: string): boolean {
  if (!hasTokenSegmentShape(token) || token.includes("/") || token.includes("\\")) return false;
  const lowered = token.toLowerCase();
  return (
    !lowered.includes("%2f") &&
    !lowered.includes("%5c") &&
    !lowered.includes("%2e")
  );
}

/**
 * Redirect target (`/l/:token` → `/wishlist/:token`).
 *
 * Built from the validated segment only; a raw pathname or `safeNextPath` over
 * `/l/...` is never used, because normalisation can turn `/l/abc/../../admin`
 * into another route. A query/fragment delimiter or any percent-encoding could
 * change what the browser requests, so those values keep the not-found answer.
 */
const UNSAFE_TARGET_CHARACTERS = /[\\/?#%\u0000-\u001f\u007f]/;

export function wishlistPathForToken(token: string): string | null {
  if (!isPublicTokenSegment(token)) return null;
  return `/wishlist/${token}`;
}

/**
 * The public address of the list itself (`/l/:token`) — the way back from
 * `/l/:token/:giftId` and the base of a wish card there. It takes the same gate
 * as {@link wishlistPathForToken}, so a forged segment never reaches an `href`.
 */
export function publicListPathForToken(token: string): string | null {
  if (!isPublicTokenSegment(token)) return null;
  return `/l/${token}`;
}

/**
 * Redirect target and return path of an invite (`/i/:token` → `/invite/:token`,
 * Story 4.7). Built from the validated segment only, with the same gate as
 * {@link wishlistPathForToken}: `/i` is served by Next.js, so the app screen has
 * its own `/invite/:token` address (AD-26).
 */
export function invitePathForToken(token: string): string | null {
  if (!isPublicTokenSegment(token)) return null;
  return `/invite/${token}`;
}
