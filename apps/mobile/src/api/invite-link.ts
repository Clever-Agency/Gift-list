import {
  inviteLinkAcceptDataSchema,
  inviteLinkDataSchema,
  inviteLinkPreviewSchema,
  type InviteLinkAcceptOutcome,
  type InviteLinkInviter,
  type InviteLinkState,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

/** The viewer's own link: the immutable token, or why there is none. */
export type MyInviteLinkResult =
  | { ok: true; token: string }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 4.7: the inviter and, for a signed-in viewer, their closed relation to
 * the link. `state` is absent for a guest, exactly as the server answers.
 */
export type InvitePreviewResult =
  | { ok: true; inviter: InviteLinkInviter; state?: InviteLinkState }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/** Story 4.7: the closed accept answer. `ALREADY_FRIENDS` is a successful no-op. */
export type InviteAcceptResult =
  | { ok: true; outcome: InviteLinkAcceptOutcome }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * The invite token as one safe path segment, mirroring the server gate of
 * `/api/v1/i/:token` and the wishlist link token: no separator, query, fragment,
 * percent-encoding or dot segment, and no more than 128 characters. Existence is
 * not checked here — the server answers every unknown token with the same
 * `NOT_FOUND` as a block.
 */
const UNSAFE_SEGMENT = /[\\/?#%\u0000-\u001f\u007f]/;
const TOKEN_MAX_LENGTH = 128;

function inviteTokenSegment(value: string): string | null {
  if (value.length === 0 || value.length > TOKEN_MAX_LENGTH) return null;
  if (UNSAFE_SEGMENT.test(value) || value.includes("..")) return null;
  return value;
}

/**
 * `GET /api/v1/me/invite-link`: the viewer's own immutable token. The link is
 * built by the caller as `{origin}/i/{token}`, the same way the wishlist screen
 * builds `{origin}/l/{publicToken}` (Story 2.4), so no domain is fixed here.
 */
export async function getMyInviteLink(): Promise<MyInviteLinkResult> {
  const result = await apiRequest<unknown>("/api/v1/me/invite-link");
  if (!result.ok) return result;

  const parsed = inviteLinkDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, token: parsed.data.token };
}

/**
 * `GET /api/v1/i/:token`: the read-only preview. It works for a guest (no
 * `state`) and for a signed-in viewer (`self / friends / can_accept`). An unknown
 * token and a block arrive as the same API refusal, so the screen shows one
 * «Приглашение не найдено.» without learning which of the two it was.
 */
export async function getInvitePreview(token: string): Promise<InvitePreviewResult> {
  const segment = inviteTokenSegment(token);
  if (segment === null) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(`/api/v1/i/${encodeURIComponent(segment)}`);
  if (!result.ok) return result;

  const parsed = inviteLinkPreviewSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return {
    ok: true,
    inviter: parsed.data.inviter,
    ...(parsed.data.state === undefined ? {} : { state: parsed.data.state }),
  };
}

/**
 * `POST /api/v1/i/:token/accept`: the signed-in viewer confirms the link. The
 * body is not sent, because the token in the path is the whole input. The server
 * owns the transaction and the pair lock; the client only shows the closed
 * outcome (`FRIENDS` or the idempotent `ALREADY_FRIENDS`).
 */
export async function acceptInvite(token: string): Promise<InviteAcceptResult> {
  const segment = inviteTokenSegment(token);
  if (segment === null) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    `/api/v1/i/${encodeURIComponent(segment)}/accept`,
    { method: "POST" },
  );
  if (!result.ok) return result;

  const parsed = inviteLinkAcceptDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, outcome: parsed.data.outcome };
}
