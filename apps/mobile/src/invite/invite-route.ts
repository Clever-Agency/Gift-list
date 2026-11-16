import { INVITE_TOKEN_MAX, safeNextPath } from "@gift-list/contracts";

/**
 * Story 4.7 / AD-26: an invite token is exactly one safe path segment of
 * `/invite/:token`, the app address behind the Next `/i/:token` page.
 *
 * The value is used twice — as the `api/v1/i/:token` segment and as the `next`
 * target of registration — so both are built from this one validated value.
 * The gate mirrors the server and the wishlist link: no separator, query,
 * fragment, percent-encoding or dot segment, and no more than 128 characters.
 * Existence is not checked here: the server answers every unknown token with the
 * same `NOT_FOUND` as a block.
 */
const UNSAFE_SEGMENT_CHARACTERS = /[\\/?#%\u0000-\u001f\u007f]/;

export type InviteRoute = {
  readonly token: string;
  readonly next: string;
};

export function inviteRoute(value: unknown): InviteRoute | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > INVITE_TOKEN_MAX) return null;
  if (UNSAFE_SEGMENT_CHARACTERS.test(value)) return null;
  if (value === "." || value === ".." || value.includes("..")) return null;

  const next = `/invite/${value}`;
  if (safeNextPath(next) !== next) return null;

  return { token: value, next };
}

/** The one `next` that carries the token into registration (AD-21). */
const INVITE_NEXT = /^\/invite\/([^/?#%\\]+)$/;

/**
 * The invite token of `next=/invite/{token}`, or `undefined` for every other
 * return path. A registration through `/l/:token` (already rewritten to
 * `/wishlist/:token` by `safeNextPath`) must never create a friendship
 * (AD-15-11), so only this exact pattern sends `inviteToken`.
 */
export function inviteTokenFromNext(next: string): string | undefined {
  const match = INVITE_NEXT.exec(next);
  if (match === null) return undefined;
  const token = match[1];
  if (token.length > INVITE_TOKEN_MAX) return undefined;
  if (token === "." || token.includes("..")) return undefined;
  return safeNextPath(next) === next ? token : undefined;
}
