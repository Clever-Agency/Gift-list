import {
  blockDataSchema,
  blockedPageSchema,
  unblockDataSchema,
  type BlockOutcome,
  type BlockedPage,
  type UnblockOutcome,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";
import { profileRoute } from "@/profile/profile-route";

type OutcomeResult<T extends string> =
  | { ok: true; outcome: T }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/** Story 4.5: the closed block answer. `ALREADY_BLOCKED` is a successful no-op. */
export type BlockResult = OutcomeResult<BlockOutcome>;

/** Story 4.5: the closed unblock answer. `NOT_BLOCKED` is the same no-op. */
export type UnblockResult = OutcomeResult<UnblockOutcome>;

/** One page of «Заблокированные» that passed the shared contract, or why not. */
export type BlockedPageResult =
  | { ok: true; page: BlockedPage }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/** The closed success envelope both block mutations answer with. */
type OutcomeSchema<T extends string> = {
  safeParse: (
    value: unknown,
  ) => { success: true; data: { outcome: T } } | { success: false };
};

/**
 * One request to `/api/v1/u/:nick/block`: `POST` blocks the nick's owner for the
 * session user and `DELETE` removes that same own block. The body is not sent,
 * because the target is exactly the nick in the path. A malformed segment is
 * rejected before a request, like the profile read and the server route, so a
 * broken nick never turns into a network error.
 */
async function blockRequest<T extends string>(
  nick: string,
  method: "POST" | "DELETE",
  schema: OutcomeSchema<T>,
): Promise<OutcomeResult<T>> {
  const route = profileRoute(nick);
  if (route === null) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    `/api/v1/u/${encodeURIComponent(route.nick)}/block`,
    { method },
  );
  if (!result.ok) return result;

  const parsed = schema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, outcome: parsed.data.outcome };
}

/**
 * Story 4.5 (FR-24, AD-10 step 4): block the nick's owner. The server cuts the
 * friendship, the pending invites of the pair and both subscriptions, and keeps
 * the reservations of the viewer's wishes; the client only needs the closed
 * outcome, and a repeat is the successful `ALREADY_BLOCKED`.
 */
export function blockUser(nick: string): Promise<BlockResult> {
  return blockRequest(nick, "POST", blockDataSchema);
}

/**
 * Story 4.5 (AD-10 step 4): remove the viewer's own block of the nick's owner.
 * Nothing is restored by it, and a repeat is the successful `NOT_BLOCKED`.
 */
export function unblockUser(nick: string): Promise<UnblockResult> {
  return blockRequest(nick, "DELETE", unblockDataSchema);
}

/**
 * `GET /api/v1/me/blocks?cursor=`: the people the viewer blocked, one page.
 * The cursor is opaque and only travels back as the server issued it; an absent
 * or blank one asks for the first page.
 */
export async function listBlocked(cursor?: string): Promise<BlockedPageResult> {
  const query =
    cursor === undefined || cursor === "" ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  const result = await apiRequest<unknown>(`/api/v1/me/blocks${query}`);
  if (!result.ok) return result;

  const parsed = blockedPageSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, page: parsed.data };
}
