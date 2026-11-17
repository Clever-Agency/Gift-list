import "server-only";

import {
  inviteLinkAcceptDataSchema,
  inviteLinkDataSchema,
  inviteLinkPreviewSchema,
  notFoundError,
  type ActionResult,
  type InviteLinkAcceptData,
  type InviteLinkData,
  type InviteLinkInviter,
  type InviteLinkPreview,
} from "@gift-list/contracts";
import { acceptInviteLink, readInviteLinkState, type InviteLinkOwner } from "@/domain/invite-link";
import { auth } from "@/lib/auth";
import { ensureInviteLink, inviteLinkStore } from "@/lib/invite-link-store";
import { isPublicTokenSegment } from "@/lib/public-token";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * Unknown token, malformed segment and a `Block` in either direction: the one
 * shared `NOT_FOUND` refusal (AD-12 ред. 2026-11-17), so the preview never
 * reveals that somebody blocked the viewer and the body matches `/l` and `/u`.
 */

/** The viewer's own link is the closed `FORBIDDEN` refusal, like a self pair elsewhere. */
const forbidden = {
  ok: false as const,
  code: "FORBIDDEN" as const,
  message: "Forbidden",
};

/** The owner as the preview names them: the two public fields of the `/l` owner block. */
function toInviter(owner: InviteLinkOwner): InviteLinkInviter {
  return { displayName: owner.displayName, nick: owner.nick };
}

/**
 * AD-21 (Story 4.7): `GET /api/v1/me/invite-link` — the session user's immutable
 * link token. A user created before Story 4.7.1 has no row yet, so the token is
 * issued lazily here and the link works from the first request on. Only the
 * token is returned: the client builds `{origin}/i/{token}` the same way it
 * builds `{origin}/l/{publicToken}`.
 */
export async function getMyInviteLink(headers: Headers): Promise<ActionResult<InviteLinkData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const token = await ensureInviteLink(session.user.id);
  return { ok: true, data: inviteLinkDataSchema.parse({ token }) };
}

/**
 * AD-21 (Story 4.7): `GET /api/v1/i/:token` — who invites. It writes nothing:
 * the anonymous branch only resolves the token owner, and the signed-in branch
 * runs `readInviteLinkState`, whose reader has no write method at all, so a
 * messenger prefetch or a page load can never create a relationship.
 *
 * A guest gets the inviter fields of `/l` and no `state`; a signed-in viewer
 * additionally gets their closed relation (`self`, `friends`, `can_accept`). A
 * malformed segment is the same `NOT_FOUND` 404 before any read, so an unknown
 * token, a bad segment and a `Block` stay indistinguishable — the token is never
 * logged.
 */
export async function getInvitePreview(
  token: string,
  headers: Headers,
): Promise<ActionResult<InviteLinkPreview>> {
  if (!isPublicTokenSegment(token)) return notFoundError();

  const session = await auth.api.getSession({ headers });
  if (!session) {
    const owner = await inviteLinkStore.findOwnerByToken(token);
    if (owner === null) return notFoundError();
    return { ok: true, data: inviteLinkPreviewSchema.parse({ inviter: toInviter(owner) }) };
  }

  const preview = await readInviteLinkState(inviteLinkStore, {
    viewerId: session.user.id,
    token,
  });
  if (preview.state === "not_found") return notFoundError();

  return {
    ok: true,
    data: inviteLinkPreviewSchema.parse({
      inviter: toInviter(preview.owner),
      state: preview.state,
    }),
  };
}

/**
 * AD-21 (Story 4.7): `POST /api/v1/i/:token/accept` — the signed-in viewer
 * confirms the link. The domain owns the transaction: the owner is resolved
 * inside it, the pair lock serializes with every other friendship write, and
 * either-side `Block` is the same `NOT_FOUND` as an unknown token.
 *
 * The viewer's own token is `FORBIDDEN` without a reason (the screen shows
 * «Это ваша ссылка-приглашение»). A repeat is 200 `ALREADY_FRIENDS` and writes
 * nothing; `FRIENDS` inserted the single edge. No `InviteCooldown` is read or
 * written and no subscription is touched — an invite link is the owner's own
 * consent (plan 4.7, п. 5).
 */
export async function acceptInviteByToken(
  token: string,
  headers: Headers,
): Promise<ActionResult<InviteLinkAcceptData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  if (!isPublicTokenSegment(token)) return notFoundError();

  const result = await acceptInviteLink(
    { viewerId: session.user.id, token },
    inviteLinkStore,
  );
  if (!result.ok) return result.code === "FORBIDDEN" ? forbidden : notFoundError();

  return { ok: true, data: inviteLinkAcceptDataSchema.parse({ outcome: result.outcome }) };
}
